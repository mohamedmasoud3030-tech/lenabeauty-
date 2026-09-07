/**
 * Admin-only live voice session.
 *
 * Uses Gemini Live over WebSocket with the administrator's key. No bundled
 * env, no salon writes. Falls back to browser speech if Live is unavailable.
 */

import { askGemini, type ChatTurn } from "./adminAssistant";

export const GEMINI_LIVE_MODELS = [
  "gemini-3.1-flash-live-preview",
  "gemini-2.5-flash-native-audio-preview",
  "gemini-live-2.5-flash-native-audio",
] as const;

export type LiveStatus = "idle" | "connecting" | "listening" | "speaking";

export type LiveHandlers = {
  onStatus: (status: LiveStatus) => void;
  onUserTranscript: (text: string, done: boolean) => void;
  onModelTranscript: (text: string, done: boolean) => void;
  onError: (code: string) => void;
};

export type LiveSession = {
  stop: () => void;
  sendText: (text: string) => void;
};

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function floatTo16BitPcm(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

function downsample(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return buffer;
  const ratio = inputRate / outputRate;
  const length = Math.max(1, Math.round(buffer.length / ratio));
  const result = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(buffer.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    const span = Math.max(1, end - start);
    for (let j = start; j < end; j += 1) sum += buffer[j] ?? 0;
    result[i] = sum / span;
  }
  return result;
}

function pcm16ToFloat(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const samples = new Float32Array(Math.floor(bytes.byteLength / 2));
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  return samples;
}

async function parseSocketData(data: unknown): Promise<Record<string, unknown>> {
  if (typeof data === "string") return JSON.parse(data) as Record<string, unknown>;
  if (data instanceof Blob) return JSON.parse(await data.text()) as Record<string, unknown>;
  if (data instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(data)) as Record<string, unknown>;
  throw new Error("GEMINI_LIVE_UNAVAILABLE");
}

function createPlayer(sampleRate: number) {
  const ctx = new AudioContext();
  let next = 0;
  const sources: AudioBufferSourceNode[] = [];

  async function play(pcm: Uint8Array) {
    if (ctx.state === "suspended") await ctx.resume();
    const sourceRate = sampleRate;
    const floats = pcm16ToFloat(pcm);
    const resampled = downsample(floats, sourceRate, ctx.sampleRate);
    const buffer = ctx.createBuffer(1, resampled.length, ctx.sampleRate);
    buffer.copyToChannel(resampled, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, next);
    source.start(startAt);
    next = startAt + buffer.duration;
    sources.push(source);
    source.onended = () => {
      const index = sources.indexOf(source);
      if (index >= 0) sources.splice(index, 1);
    };
  }

  function interrupt() {
    sources.splice(0).forEach((source) => {
      try { source.stop(); } catch { /* already stopped */ }
    });
    next = ctx.currentTime;
  }

  function close() {
    interrupt();
    void ctx.close();
  }

  return { play, interrupt, close };
}

function liveSocketUrl(apiKey: string): string {
  return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`;
}

async function connectLiveSocket(apiKey: string, model: string, systemInstruction: string): Promise<WebSocket> {
  const socket = new WebSocket(liveSocketUrl(apiKey));
  await new Promise<void>((resolve, reject) => {
    const fail = () => reject(new Error("GEMINI_LIVE_UNAVAILABLE"));
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", fail, { once: true });
    socket.addEventListener("close", fail, { once: true });
  });
  socket.send(JSON.stringify({
    setup: {
      model: `models/${model}`,
      responseModalities: ["AUDIO"],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
      },
      systemInstruction: { parts: [{ text: systemInstruction }] },
    },
  }));
  return socket;
}

async function startNativeLive(params: {
  apiKey: string;
  systemInstruction: string;
  handlers: LiveHandlers;
}): Promise<LiveSession> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("GEMINI_LIVE_UNAVAILABLE");
  params.handlers.onStatus("connecting");

  let socket: WebSocket | null = null;
  let lastError = "GEMINI_LIVE_UNAVAILABLE";
  for (const model of GEMINI_LIVE_MODELS) {
    try {
      socket = await connectLiveSocket(params.apiKey, model, params.systemInstruction);
      lastError = "";
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "GEMINI_LIVE_UNAVAILABLE";
    }
  }
  if (!socket || lastError) throw new Error(lastError || "GEMINI_LIVE_UNAVAILABLE");

  const player = createPlayer(24000);
  const captureCtx = new AudioContext();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  }).catch(() => {
    socket.close();
    player.close();
    void captureCtx.close();
    throw new Error("GEMINI_MIC_DENIED");
  });
  const source = captureCtx.createMediaStreamSource(stream);
  const processor = captureCtx.createScriptProcessor(4096, 1, 1);
  const mute = captureCtx.createGain();
  mute.gain.value = 0;
  source.connect(processor);
  processor.connect(mute);
  mute.connect(captureCtx.destination);
  await captureCtx.resume();

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    processor.disconnect();
    source.disconnect();
    mute.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    void captureCtx.close();
    player.close();
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    params.handlers.onStatus("idle");
  };

  processor.onaudioprocess = (event) => {
    if (stopped || socket?.readyState !== WebSocket.OPEN) return;
    const input = event.inputBuffer.getChannelData(0);
    const resampled = downsample(input, captureCtx.sampleRate, 16000);
    const pcm = floatTo16BitPcm(resampled);
    socket.send(JSON.stringify({
      realtimeInput: {
        audio: {
          data: bytesToBase64(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)),
          mimeType: "audio/pcm;rate=16000",
        },
      },
    }));
  };

  socket.onmessage = (event) => {
    void (async () => {
      try {
        const message = await parseSocketData(event.data);
        if (message.setupComplete) {
          params.handlers.onStatus("listening");
          return;
        }
        const error = message.error as { code?: number; message?: string } | undefined;
        if (error) {
          params.handlers.onError(error.code === 403 || error.code === 401 ? "GEMINI_KEY_REJECTED" : "GEMINI_LIVE_UNAVAILABLE");
          stop();
          return;
        }
        const server = message.serverContent as {
          interrupted?: boolean;
          turnComplete?: boolean;
          modelTurn?: { parts?: Array<{ inlineData?: { data?: string } }> };
          inputTranscription?: { text?: string };
          outputTranscription?: { text?: string };
        } | undefined;
        if (!server) return;
        if (server.interrupted) {
          player.interrupt();
          params.handlers.onStatus("listening");
        }
        const input = server.inputTranscription?.text?.trim();
        if (input) params.handlers.onUserTranscript(input, Boolean(server.turnComplete));
        const output = server.outputTranscription?.text?.trim();
        if (output) params.handlers.onModelTranscript(output, Boolean(server.turnComplete));
        for (const part of server.modelTurn?.parts ?? []) {
          const data = part.inlineData?.data;
          if (!data) continue;
          params.handlers.onStatus("speaking");
          const binary = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
          await player.play(binary);
        }
        if (server.turnComplete) params.handlers.onStatus("listening");
      } catch {
        params.handlers.onError("GEMINI_LIVE_UNAVAILABLE");
        stop();
      }
    })();
  };
  socket.onerror = () => {
    params.handlers.onError("GEMINI_UNREACHABLE");
    stop();
  };
  socket.onclose = () => {
    if (!stopped) stop();
  };

  return {
    stop,
    sendText(text: string) {
      if (stopped || socket?.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ realtimeInput: { text } }));
    },
  };
}

function recognitionCtor(): SpeechRecognitionCtor | null {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

async function startBrowserLive(params: {
  apiKey: string;
  systemInstruction: string;
  language: string;
  handlers: LiveHandlers;
}): Promise<LiveSession> {
  const Ctor = recognitionCtor();
  if (!Ctor || typeof window.speechSynthesis === "undefined") throw new Error("GEMINI_LIVE_UNAVAILABLE");

  let stopped = false;
  let busy = false;
  let recognition: InstanceType<SpeechRecognitionCtor> | null = null;
  const history: ChatTurn[] = [];
  params.handlers.onStatus("listening");

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = params.language.startsWith("ar") ? "ar-SA" : "en-US";
    utterance.onstart = () => params.handlers.onStatus("speaking");
    utterance.onend = () => {
      busy = false;
      if (!stopped) {
        params.handlers.onStatus("listening");
        listen();
      }
    };
    window.speechSynthesis.speak(utterance);
  };

  const askAndSpeak = (message: string) => {
    busy = true;
    recognition?.stop();
    params.handlers.onStatus("connecting");
    void askGemini({
      apiKey: params.apiKey,
      history,
      message,
      systemInstruction: params.systemInstruction,
    }).then((reply) => {
      if (stopped) return;
      history.push({ role: "user", text: message }, { role: "model", text: reply });
      params.handlers.onModelTranscript(reply, true);
      speak(reply);
    }).catch((error) => {
      if (stopped) return;
      busy = false;
      params.handlers.onError(error instanceof Error ? error.message : "GEMINI_REQUEST_FAILED");
      params.handlers.onStatus("listening");
      listen();
    });
  };

  const listen = () => {
    if (stopped || busy) return;
    const rec = new Ctor();
    recognition = rec;
    rec.lang = params.language.startsWith("ar") ? "ar-OM" : "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (interim.trim()) params.handlers.onUserTranscript(interim.trim(), false);
      const message = finalText.trim();
      if (!message) return;
      params.handlers.onUserTranscript(message, true);
      askAndSpeak(message);
    };
    rec.onerror = (event: { error?: string }) => {
      if (stopped) return;
      if (event.error === "aborted" || event.error === "no-speech") return;
      if (event.error === "not-allowed") params.handlers.onError("GEMINI_MIC_DENIED");
    };
    rec.onend = () => {
      if (!stopped && !busy) window.setTimeout(listen, 250);
    };
    rec.start();
  };

  listen();

  return {
    stop() {
      stopped = true;
      recognition?.stop();
      window.speechSynthesis.cancel();
      params.handlers.onStatus("idle");
    },
    sendText(text: string) {
      if (stopped || !text.trim()) return;
      params.handlers.onUserTranscript(text, true);
      askAndSpeak(text);
    },
  };
}

export async function startLiveAssistant(params: {
  apiKey: string;
  systemInstruction: string;
  language: string;
  handlers: LiveHandlers;
}): Promise<LiveSession> {
  try {
    return await startNativeLive(params);
  } catch (error) {
    const code = error instanceof Error ? error.message : "GEMINI_LIVE_UNAVAILABLE";
    if (code === "GEMINI_MIC_DENIED" || code === "GEMINI_KEY_REJECTED") throw error;
    return startBrowserLive(params);
  }
}
