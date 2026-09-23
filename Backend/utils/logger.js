/**
 * Lightweight logging helpers.
 * Info/debug noise is gated; errors always log (never log secrets).
 */
export const isDevLog =
  process.env.NODE_ENV !== 'production' || process.env.MONITOR_VERBOSE_LOGS === 'true';

export const logInfo = (...args) => {
  if (isDevLog) console.log(...args);
};

export const logError = (...args) => {
  console.error(...args);
};

export const logWarn = (...args) => {
  console.warn(...args);
};
