/**
 * Minimal logger.
 *
 * Suppresses debug/info/log noise in production builds while always surfacing
 * warnings and errors. Replaces scattered `console.log` calls so production
 * bundles stay quiet (and don't leak internal payloads to the browser console).
 */
const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};

export default logger;
