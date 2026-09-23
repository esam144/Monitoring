import Website from '../model/Website.js';
import { logError, logInfo } from '../utils/logger.js';
import { checkWebsite } from './monitoringService.js';

// Poll frequently enough to honor 1-minute check intervals
const DEFAULT_POLL_MS = 15_000;

let started = false;
let timer = null;
const inFlight = new Set();

const getPollIntervalMs = () => {
  const value = Number(process.env.MONITOR_POLL_INTERVAL_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_POLL_MS;
};

/**
 * Due-check worker: only checks websites where monitoringEnabled
 * and nextCheckAt <= now (or nextCheckAt is null / missing).
 */
const runDueChecks = async () => {
  try {
    const now = new Date();

    const websites = await Website.find({
      monitoringEnabled: true,
      $or: [{ nextCheckAt: { $lte: now } }, { nextCheckAt: null }],
    });

    if (websites.length === 0) return;

    await Promise.all(
      websites.map(async (website) => {
        const id = website._id.toString();
        if (inFlight.has(id)) return;

        inFlight.add(id);
        try {
          await checkWebsite(website);
        } catch (error) {
          logError(
            `[MONITOR] Unexpected error checking ${website.name}:`,
            error.message
          );
        } finally {
          inFlight.delete(id);
        }
      })
    );
  } catch (error) {
    logError('[MONITOR] Scheduler tick failed:', error.message);
  }
};

/**
 * Start the monitoring scheduler once per process.
 */
export const startMonitoringScheduler = () => {
  if (started) {
    return;
  }

  started = true;
  const pollMs = getPollIntervalMs();

  logInfo(
    `[MONITOR] Scheduler started (due-check poll every ${Math.round(pollMs / 1000)}s)`
  );

  setTimeout(() => {
    runDueChecks();
  }, 2000);

  timer = setInterval(runDueChecks, pollMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
};

export const stopMonitoringScheduler = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  started = false;
  inFlight.clear();
};
