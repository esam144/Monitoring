import {
  sendCombinedDownAlert,
  sendMonitoringSlackAlert,
} from './slackService.js';
import { logError, logInfo } from '../utils/logger.js';

/**
 * Non-repeating alert evaluation for monitoring status transitions.
 *
 * Rules:
 *   UP → DOWN  → queue DOWN (batched Slack message)
 *   DOWN → DOWN → no alert (keep monitoring)
 *   DOWN → UP  → one RECOVERY alert (immediate, per site)
 *   UP → UP    → no alert
 *
 * Multiple DOWNs within DOWN_BATCH_MS are sent as one Slack message.
 * Slack failures never throw into the monitor path.
 */

const DOWN_BATCH_MS = 500;

/** @type {Array<{ website: object, checkedAt: Date }>} */
let pendingDowns = [];
let downFlushTimer = null;

/**
 * @param {object} website - Mongoose website document (mutated: lastAlertStatus)
 * @param {'up'|'down'} currentStatus
 * @param {{ statusCode?: number|null, responseTime?: number|null, checkedAt?: Date }} [checkMeta]
 * @returns {{ alertType: 'down'|'recovery'|null, previousAlertStatus: string|null }}
 */
export const evaluateStatusAlert = (website, currentStatus, checkMeta = {}) => {
  const previousAlertStatus = website.lastAlertStatus ?? null;
  let alertType = null;

  if (currentStatus === 'down') {
    if (previousAlertStatus !== 'down') {
      alertType = 'down';
      website.lastAlertStatus = 'down';
      emitAlert(website, 'down', checkMeta);
    }
  } else if (currentStatus === 'up') {
    if (previousAlertStatus === 'down') {
      alertType = 'recovery';
      emitAlert(website, 'recovery', checkMeta);
    }
    website.lastAlertStatus = 'up';
  }

  return { alertType, previousAlertStatus };
};

const scheduleDownFlush = () => {
  if (downFlushTimer) clearTimeout(downFlushTimer);
  downFlushTimer = setTimeout(() => {
    downFlushTimer = null;
    void flushPendingDownAlerts();
  }, DOWN_BATCH_MS);

  if (typeof downFlushTimer.unref === 'function') {
    downFlushTimer.unref();
  }
};

/**
 * Flush queued DOWN alerts as one combined Slack message.
 * Safe to call manually (e.g. after a test batch).
 */
export const flushPendingDownAlerts = async () => {
  if (downFlushTimer) {
    clearTimeout(downFlushTimer);
    downFlushTimer = null;
  }

  if (pendingDowns.length === 0) return { ok: true, count: 0 };

  const batch = pendingDowns.splice(0, pendingDowns.length);
  logInfo(
    `[ALERT] Flushing ${batch.length} DOWN alert(s) as one Slack message`
  );

  try {
    const result = await sendCombinedDownAlert(batch);
    return { ...result, count: batch.length };
  } catch (error) {
    logError('[SLACK] Combined DOWN flush error:', error.message);
    return { ok: false, error: error.message, count: batch.length };
  }
};

/**
 * Queue Slack (and console) notification without blocking monitoring.
 */
const emitAlert = (website, alertType, checkMeta = {}) => {
  const checkedAt = checkMeta.checkedAt ?? website.lastCheckedAt ?? new Date();

  if (alertType === 'down') {
    logInfo(`[ALERT] ${website.name} is DOWN — queued for batched Slack alert`);
    // Deduplicate by website id within the batch window
    const id = website._id?.toString?.() || website.id;
    pendingDowns = pendingDowns.filter(
      (entry) => (entry.website._id?.toString?.() || entry.website.id) !== id
    );
    pendingDowns.push({ website, checkedAt });
    scheduleDownFlush();
    return;
  }

  if (alertType === 'recovery') {
    logInfo(`[ALERT] ${website.name} recovered (UP) — sending Slack alert`);
    void sendMonitoringSlackAlert({
      website,
      alertType: 'recovery',
      statusCode: checkMeta.statusCode ?? null,
      responseTime: checkMeta.responseTime ?? website.lastResponseTime ?? null,
      checkedAt,
    }).catch((error) => {
      logError(
        `[SLACK] Unexpected recovery alert error for ${website.name}:`,
        error.message
      );
    });
  }
};
