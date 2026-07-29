import { isDesktopShell } from './config';

export class DesktopBridgeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesktopBridgeUnavailableError';
  }
}

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: {
      invoke?: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
  }
}

export async function invokeDesktop<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isDesktopShell()) {
    throw new DesktopBridgeUnavailableError('Tauri desktop shell is not available in this environment');
  }

  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (!invoke) {
    throw new DesktopBridgeUnavailableError('Tauri invoke bridge is not available');
  }

  return invoke<T>(command, args);
}
