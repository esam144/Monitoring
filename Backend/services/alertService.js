import Website from '../model/Website.js';
import {
  getSlackSettings,
  intervalToMs,
} from '../utils/interval.js';
import { logError, logInfo } from '../utils/logger.js';
import {
  sendCombinedDownAlert,
  sendMonitoringSlackAlert,
} from './slackService.js';

/**
 * Slack alert evaluation for monitoring status checks.
 *
 * Rules (when slackSettings.enabled):
 *   First DOWN in an incident → immediate Slack (batched)
 *   Still DOWN + repeat interval elapsed (or never successfully notified)
 *     → Slack again; lastSlackNotificationAt updated only after Slack success
 *   DOWN → UP + recoveryNotification → recovery Slack; clear incident after success
 *   DOWN → UP + !recoveryNotification → clear incident, no Slack
 *
 * Multiple first/repeat DOWNs within DOWN_BATCH_MS are sent as one Slack message.
 * Slack failures never throw into the monitor path.
 */

const DOWN_BATCH_MS = 500;

/** @type {Array<{ website: object, checkedAt: Date, websiteId: string }>} */
let pendingDowns = [];
let downFlushTimer = null;

const websiteIdOf = (website) =>
  website?._id?.toString?.() || website?.id?.toString?.() || null;

/**
 * Persist lastSlackNotificationAt only after Slack success.
 */
const markSlackNotified = async (websiteId, notifiedAt) => {
  if (!websiteId) return;
  const at = notifiedAt instanceof Date ? notifiedAt : new Date(notifiedAt);
  try {
    await Website.updateOne(
      { _id: websiteId },
      { $set: { lastSlackNotificationAt: at } }
    );
  } catch (error) {
    logError(
      `[ALERT] Failed to persist lastSlackNotificationAt for ${websiteId}:`,
      error.message
    );
  }
};

/**
 * Clear downtime incident fields after recovery (Slack success or recovery disabled).
 */
const clearDowntimeIncident = async (website) => {
  const id = websiteIdOf(website);
  website.lastAlertStatus = 'up';
  website.lastSlackNotificationAt = null;
  website.downtimeStartedAt = null;

  if (!id) return;
  try {
    await Website.updateOne(
      { _id: id },
      {
        $set: {
          lastAlertStatus: 'up',
          lastSlackNotificationAt: null,
          downtimeStartedAt: null,
        },
      }
    );
  } catch (error) {
    logError(
      `[ALERT] Failed to clear downtime incident for ${id}:`,
      error.message
    );
  }
};

/**
 * @param {object} website - Mongoose website document (may be mutated)
 * @param {'up'|'down'} currentStatus
 * @param {{ statusCode?: number|null, responseTime?: number|null, checkedAt?: Date }} [checkMeta]
 * @returns {Promise<{ alertType: 'down'|'recovery'|null, previousAlertStatus: string|null }>}
 */
export const evaluateStatusAlert = async (
  website,
  currentStatus,
  checkMeta = {}
) => {
  const previousAlertStatus = website.lastAlertStatus ?? null;
  const settings = getSlackSettings(website);
  const checkedAt = checkMeta.checkedAt ?? website.lastCheckedAt ?? new Date();
  let alertType = null;

  if (currentStatus === 'down') {
    const isNewIncident = previousAlertStatus !== 'down';

    if (isNewIncident) {
      website.lastAlertStatus = 'down';
      website.downtimeStartedAt = checkedAt;
    }

    if (!settings.enabled) {
      return { alertType: null, previousAlertStatus };
    }

    const lastAt = website.lastSlackNotificationAt
      ? new Date(website.lastSlackNotificationAt)
      : null;
    const repeatMs = intervalToMs(
      settings.repeatInterval,
      settings.repeatUnit
    );
    const dueForNotify =
      isNewIncident ||
      !lastAt ||
      Number.isNaN(lastAt.getTime()) ||
      checkedAt.getTime() - lastAt.getTime() >= repeatMs;

    if (dueForNotify) {
      alertType = 'down';
      queueDownAlert(website, checkedAt);
    }
  } else if (currentStatus === 'up') {
    if (previousAlertStatus === 'down') {
      if (!settings.enabled) {
        await clearDowntimeIncident(website);
        return { alertType: null, previousAlertStatus };
      }

      if (settings.recoveryNotification) {
        alertType = 'recovery';
        logInfo(`[ALERT] ${website.name} recovered (UP) — sending Slack alert`);
        try {
          const result = await sendMonitoringSlackAlert({
            website,
            alertType: 'recovery',
            statusCode: checkMeta.statusCode ?? null,
            responseTime:
              checkMeta.responseTime ?? website.lastResponseTime ?? null,
            checkedAt,
          });
          if (result?.ok) {
            await clearDowntimeIncident(website);
          } else {
            logError(
              `[SLACK] Recovery alert failed for ${website.name} — incident left open for retry:`,
              result?.error || 'unknown'
            );
          }
        } catch (error) {
          logError(
            `[SLACK] Unexpected recovery alert error for ${website.name}:`,
            error.message
          );
        }
      } else {
        await clearDowntimeIncident(website);
      }
    } else {
      website.lastAlertStatus = 'up';
    }
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
 * On success, persists lastSlackNotificationAt for each site.
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
    if (result?.ok) {
      await Promise.all(
        batch.map(async (entry) => {
          const id = entry.websiteId || websiteIdOf(entry.website);
          const at = entry.checkedAt ?? new Date();
          if (entry.website) {
            entry.website.lastSlackNotificationAt = at;
          }
          await markSlackNotified(id, at);
        })
      );
    } else {
      logError(
        '[SLACK] Combined DOWN flush did not succeed — lastSlackNotificationAt unchanged:',
        result?.error || 'unknown'
      );
    }
    return { ...result, count: batch.length };
  } catch (error) {
    logError('[SLACK] Combined DOWN flush error:', error.message);
    return { ok: false, error: error.message, count: batch.length };
  }
};

/**
 * Queue a DOWN alert for batched Slack delivery.
 * lastSlackNotificationAt is updated only after a successful Slack flush.
 */
const queueDownAlert = (website, checkedAt) => {
  const id = websiteIdOf(website);
  logInfo(`[ALERT] ${website.name} is DOWN — queued for batched Slack alert`);
  pendingDowns = pendingDowns.filter((entry) => entry.websiteId !== id);
  pendingDowns.push({ website, checkedAt, websiteId: id });
  scheduleDownFlush();
};
