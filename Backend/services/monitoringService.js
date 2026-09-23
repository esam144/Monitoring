import MonitorCheck from '../model/MonitorCheck.js';
import { computeNextCheckAt } from '../utils/interval.js';
import { logInfo } from '../utils/logger.js';
import { evaluateStatusAlert } from './alertService.js';
import { broadcastMonitoringEvent } from './monitoringEvents.js';

const DEFAULT_TIMEOUT_MS = 10000;

const getTimeoutMs = () => {
  const value = Number(process.env.MONITOR_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
};

/**
 * Classify reachability from an HTTP status code.
 * - backend: any response except 5xx means the service is reachable (UP).
 *   4xx (404/401/403/…) means the server answered; it is NOT DOWN.
 * - frontend: only 200 is UP (page must load successfully).
 * Network/timeout failures are handled separately (always DOWN).
 */
const classifyHttpStatus = (type, statusCode) => {
  if (type === 'backend') {
    return statusCode >= 500 ? 'down' : 'up';
  }
  return statusCode === 200 ? 'up' : 'down';
};

/**
 * Central health-check function used by:
 * - scheduler
 * - manual check endpoint
 * - immediate check when monitoring is enabled
 * - immediate check when URL changes while monitoring is on
 *
 * Creates a MonitorCheck record and updates Website last* + nextCheckAt.
 * Network/timeout failures never throw — they record status=down.
 * Alerts fire only on status transitions (via lastAlertStatus).
 * Live SSE clients (per-site terminal) receive check events.
 */
export const checkWebsite = async (website) => {
  const timeoutMs = getTimeoutMs();
  const checkedAt = new Date();
  const start = Date.now();
  const previousStatus = website.lastStatus;
  const websiteId = website._id;

  logInfo(`[MONITOR] Checking ${website.name}...`);

  broadcastMonitoringEvent('check_started', {
    websiteId,
    websiteName: website.name,
    url: website.url,
    siteType: website.type,
    checkedAt: checkedAt.toISOString(),
    message: 'Checking website…',
  });

  let status = 'down';
  let statusCode = null;
  let responseTime = null;
  let errorMessage = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(website.url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'MonitoringBackend/1.0',
          Accept: '*/*',
        },
      });

      responseTime = Date.now() - start;
      statusCode = response.status;
      status = classifyHttpStatus(website.type, statusCode);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    responseTime = Date.now() - start;

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      errorMessage = 'Request timeout';
      responseTime = timeoutMs;
    } else {
      errorMessage = error.message || 'Network error';
    }

    status = 'down';
    statusCode = null;
  }

  if (status === 'up') {
    logInfo(
      `[MONITOR] ${website.name} → UP (${statusCode}) - ${responseTime}ms`
    );
  } else if (errorMessage) {
    logInfo(`[MONITOR] ${website.name} → DOWN - ${errorMessage}`);
  } else {
    logInfo(
      `[MONITOR] ${website.name} → DOWN (${statusCode}) - ${responseTime}ms`
    );
  }

  const check = await MonitorCheck.create({
    website: website._id,
    websiteName: website.name,
    websiteUrl: website.url,
    status,
    statusCode,
    responseTime,
    checkedAt,
  });

  website.lastStatus = status;
  website.lastCheckedAt = checkedAt;
  website.lastResponseTime = responseTime;

  const { alertType } = evaluateStatusAlert(website, status, {
    statusCode,
    responseTime,
    checkedAt,
  });

  if (website.monitoringEnabled) {
    website.nextCheckAt = computeNextCheckAt(
      checkedAt,
      website.checkInterval,
      website.checkIntervalUnit || 'minutes'
    );
  } else {
    website.nextCheckAt = null;
  }

  await website.save();

  broadcastMonitoringEvent('check_completed', {
    websiteId,
    websiteName: website.name,
    url: website.url,
    siteType: website.type,
    status,
    statusCode,
    responseTime,
    error: errorMessage,
    alertType,
    checkedAt: checkedAt.toISOString(),
    message:
      status === 'up'
        ? `Status: UP · HTTP ${statusCode ?? '—'} · ${responseTime ?? '—'}ms`
        : errorMessage
          ? `Status: DOWN · Connection failed · ${errorMessage}`
          : `Status: DOWN · HTTP ${statusCode ?? '—'} · ${responseTime ?? '—'}ms`,
  });

  if (alertType === 'down' || alertType === 'recovery') {
    broadcastMonitoringEvent('alert', {
      websiteId,
      websiteName: website.name,
      alertType,
      checkedAt: checkedAt.toISOString(),
      message:
        alertType === 'recovery'
          ? 'Recovery notification sent to Slack'
          : 'Down notification queued for Slack',
    });
  }

  return {
    status: check.status,
    statusCode: check.statusCode,
    responseTime: check.responseTime,
    checkedAt: check.checkedAt,
    previousStatus,
    lastAlertStatus: website.lastAlertStatus,
    alertType,
    nextCheckAt: website.nextCheckAt,
  };
};
