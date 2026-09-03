import { useEffect, useState } from "react";

/** Pixels of covered viewport that count as "the software keyboard is open". */
export const KEYBOARD_OPEN_THRESHOLD = 80;

/**
 * How much of the layout viewport is covered by the on-screen keyboard.
 * iOS Safari keeps the layout viewport the same size and overlays the
 * keyboard; visualViewport is the only reliable signal there.
 */
export function measureKeyboardInset(): number {
  if (typeof window === "undefined") return 0;
  const viewport = window.visualViewport;
  if (!viewport) return 0;
  return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
}

export function applyKeyboardInset(inset: number) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--keyboard-inset", `${inset}px`);
  root.classList.toggle("keyboard-open", inset > KEYBOARD_OPEN_THRESHOLD);
}

export function clearKeyboardInset() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--keyboard-inset", "0px");
  root.classList.remove("keyboard-open");
}

/**
 * Publishes `--keyboard-inset` and `.keyboard-open` so fixed chrome
 * (bottom nav, FABs, sticky pay bars) can get out of the way.
 */
export function useKeyboardInset(): { inset: number; isOpen: boolean } {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const update = () => {
      const next = measureKeyboardInset();
      setInset(next);
      applyKeyboardInset(next);
    };

    update();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      clearKeyboardInset();
    };
  }, []);

  return { inset, isOpen: inset > KEYBOARD_OPEN_THRESHOLD };
}

/** Keeps the focused field above the keyboard on small portrait screens. */
export function useScrollFieldIntoView() {
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const el = event.target as HTMLElement | null;
      if (!el) return;
      if (!["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      window.setTimeout(() => {
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      }, 280);
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);
}
