import MonitorCheck from '../model/MonitorCheck.js';
import Website from '../model/Website.js';
import { computeNextCheckAt } from '../utils/interval.js';
import { logInfo } from '../utils/logger.js';
import { evaluateStatusAlert } from './alertService.js';
import { broadcastMonitoringEvent } from './monitoringEvents.js';

const DEFAULT_TIMEOUT_MS = 10000;

/** Per-website lock shared by scheduler, Check Now, and immediate checks. */
const checkInFlight = new Set();

export const clearCheckInFlight = () => checkInFlight.clear();

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
 * Resolve /health + base targets for backend sites.
 * - Does not append /health when the saved URL already ends with /health.
 * - Strips trailing slashes so we never produce //health or /health/health.
 * - explicitHealth: user saved …/health directly (404 must not fall back).
 */
const resolveBackendCheckUrls = (rawUrl) => {
  const parsed = new URL(rawUrl);
  const pathNoTrailing = parsed.pathname.replace(/\/+$/, '') || '';
  const alreadyHealth = /\/health$/i.test(pathNoTrailing);

  if (alreadyHealth) {
    return {
      healthUrl: `${parsed.origin}${pathNoTrailing}`,
      baseUrl: null,
      explicitHealth: true,
    };
  }

  const baseUrl = pathNoTrailing
    ? `${parsed.origin}${pathNoTrailing}`
    : parsed.origin;

  return {
    healthUrl: `${baseUrl}/health`,
    baseUrl,
    explicitHealth: false,
  };
};

/**
 * Perform a single timed GET. Never throws — network/timeout become errorMessage.
 */
const fetchCheckUrl = async (url, timeoutMs, startedAt) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'MonitoringBackend/1.0',
        Accept: '*/*',
      },
    });

    return {
      statusCode: response.status,
      responseTime: Date.now() - startedAt,
      errorMessage: null,
      checkedUrl: url,
    };
  } catch (error) {
    let responseTime = Date.now() - startedAt;
    let errorMessage = error.message || 'Network error';

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      errorMessage = 'Request timeout';
      responseTime = timeoutMs;
    }

    return {
      statusCode: null,
      responseTime,
      errorMessage,
      checkedUrl: url,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Backend probe:
 * 1. If saved URL ends with /health: check that URL only.
 *    200 → UP; 404 / other / timeout / network → DOWN (never fall back).
 * 2. If saved URL is a base: check <base>/health first.
 *    200 → UP; 404 → fall back to base (existing backend classification);
 *    any other status / timeout / network → DOWN.
 */
const probeBackend = async (websiteUrl, timeoutMs, startedAt) => {
  let healthUrl;
  let baseUrl;
  let explicitHealth;

  try {
    ({ healthUrl, baseUrl, explicitHealth } = resolveBackendCheckUrls(websiteUrl));
  } catch (error) {
    return {
      statusCode: null,
      responseTime: Date.now() - startedAt,
      errorMessage: error.message || 'Invalid URL',
      checkedUrl: websiteUrl,
      status: 'down',
    };
  }

  const health = await fetchCheckUrl(healthUrl, timeoutMs, startedAt);

  if (health.errorMessage) {
    return { ...health, status: 'down' };
  }

  if (health.statusCode === 200) {
    return { ...health, status: 'up' };
  }

  if (health.statusCode === 404) {
    // Explicitly saved /health URL: 404 means DOWN — never fall back.
    if (explicitHealth || !baseUrl) {
      return { ...health, status: 'down' };
    }

    // Auto-appended /health missing — fall back to the base URL.
    const base = await fetchCheckUrl(baseUrl, timeoutMs, startedAt);
    if (base.errorMessage) {
      return { ...base, status: 'down' };
    }

    return {
      ...base,
      status: classifyHttpStatus('backend', base.statusCode),
    };
  }

  // Any other non-200 → DOWN, no fallback
  return { ...health, status: 'down' };
};

/**
 * Persist check + alert-incident fields without touching lastSlackNotificationAt.
 * alertService owns lastSlackNotificationAt via updateOne after Slack success;
 * a full website.save() would race and overwrite it with a stale null.
 */
const persistCheckState = async (website) => {
  await Website.updateOne(
    { _id: website._id },
    {
      $set: {
        lastStatus: website.lastStatus,
        lastCheckedAt: website.lastCheckedAt,
        lastResponseTime: website.lastResponseTime,
        nextCheckAt: website.nextCheckAt,
        lastAlertStatus: website.lastAlertStatus,
        downtimeStartedAt: website.downtimeStartedAt,
      },
    }
  );
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
 *
 * Concurrent checks for the same website are skipped (shared in-process lock).
 */
export const checkWebsite = async (website) => {
  const websiteId = website._id;
  const id = websiteId?.toString?.();

  if (!id) {
    throw new Error('Website id is required');
  }

  if (checkInFlight.has(id)) {
    logInfo(
      `[MONITOR] Skipping concurrent check for ${website.name} (already in flight)`
    );
    return {
      skipped: true,
      reason: 'check_in_progress',
      status: website.lastStatus ?? null,
      statusCode: null,
      responseTime: null,
      checkedAt: website.lastCheckedAt ?? null,
      previousStatus: website.lastStatus ?? null,
      lastAlertStatus: website.lastAlertStatus ?? null,
      alertType: null,
      nextCheckAt: website.nextCheckAt ?? null,
    };
  }

  checkInFlight.add(id);
  try {
    return await runCheckWebsite(website);
  } finally {
    checkInFlight.delete(id);
  }
};

const runCheckWebsite = async (website) => {
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
    message:
      website.type === 'backend'
        ? 'Checking backend /health…'
        : 'Checking website…',
  });

  let status = 'down';
  let statusCode = null;
  let responseTime = null;
  let errorMessage = null;
  let checkedUrl = website.url;

  if (website.type === 'backend') {
    const result = await probeBackend(website.url, timeoutMs, start);
    status = result.status;
    statusCode = result.statusCode;
    responseTime = result.responseTime;
    errorMessage = result.errorMessage;
    checkedUrl = result.checkedUrl;
  } else {
    const result = await fetchCheckUrl(website.url, timeoutMs, start);
    statusCode = result.statusCode;
    responseTime = result.responseTime;
    errorMessage = result.errorMessage;
    checkedUrl = result.checkedUrl;

    if (result.errorMessage) {
      status = 'down';
    } else {
      status = classifyHttpStatus(website.type, statusCode);
    }
  }

  if (status === 'up') {
    logInfo(
      `[MONITOR] ${website.name} → UP (${statusCode}) - ${responseTime}ms [${checkedUrl}]`
    );
  } else if (errorMessage) {
    logInfo(
      `[MONITOR] ${website.name} → DOWN - ${errorMessage} [${checkedUrl}]`
    );
  } else {
    logInfo(
      `[MONITOR] ${website.name} → DOWN (${statusCode}) - ${responseTime}ms [${checkedUrl}]`
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

  const { alertType } = await evaluateStatusAlert(website, status, {
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

  await persistCheckState(website);

  broadcastMonitoringEvent('check_completed', {
    websiteId,
    websiteName: website.name,
    url: website.url,
    checkedUrl,
    siteType: website.type,
    status,
    statusCode,
    responseTime,
    error: errorMessage,
    alertType,
    checkedAt: checkedAt.toISOString(),
    message:
      status === 'up'
        ? `Status: UP · HTTP ${statusCode ?? '—'} · ${responseTime ?? '—'}ms · ${checkedUrl}`
        : errorMessage
          ? `Status: DOWN · Connection failed · ${errorMessage} · ${checkedUrl}`
          : `Status: DOWN · HTTP ${statusCode ?? '—'} · ${responseTime ?? '—'}ms · ${checkedUrl}`,
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
