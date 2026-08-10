import '@testing-library/jest-dom';

// jsdom does not implement window.matchMedia — ThemeContext relies on it.
if (typeof window.matchMedia !== 'function') {
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom does not implement IntersectionObserver — LazyChart relies on it.
// Provide a minimal polyfill so chart-mounting components can be tested.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverPolyfill {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [0];
    private readonly callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      // Report every element as intersecting immediately (charts render).
      this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (globalThis as any).IntersectionObserver = IntersectionObserverPolyfill;
}
