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
 * Resolve /health + base targets for backend sites.
 * - Does not append /health when the saved URL already ends with /health.
 * - Strips trailing slashes so we never produce //health or /health/health.
 */
const resolveBackendCheckUrls = (rawUrl) => {
  const parsed = new URL(rawUrl);
  const pathNoTrailing = parsed.pathname.replace(/\/+$/, '') || '';
  const alreadyHealth = /\/health$/i.test(pathNoTrailing);

  if (alreadyHealth) {
    const parentPath = pathNoTrailing.replace(/\/health$/i, '');
    return {
      healthUrl: `${parsed.origin}${pathNoTrailing}`,
      baseUrl: parentPath ? `${parsed.origin}${parentPath}` : parsed.origin,
    };
  }

  const baseUrl = pathNoTrailing
    ? `${parsed.origin}${pathNoTrailing}`
    : parsed.origin;

  return {
    healthUrl: `${baseUrl}/health`,
    baseUrl,
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
 * 1. GET <base>/health first (or the saved URL if it already ends with /health).
 * 2. Only HTTP 200 from /health → UP.
 * 3. 404 → fall back to base URL (existing backend classification).
 * 4. Any other status, timeout, or network error → DOWN (no base fallback).
 */
const probeBackend = async (websiteUrl, timeoutMs, startedAt) => {
  let healthUrl;
  let baseUrl;

  try {
    ({ healthUrl, baseUrl } = resolveBackendCheckUrls(websiteUrl));
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
    // Health route missing — fall back to the base URL only in this case.
    if (baseUrl === healthUrl) {
      return { ...health, status: 'down' };
    }

    const base = await fetchCheckUrl(baseUrl, timeoutMs, startedAt);
    if (base.errorMessage) {
      return { ...base, status: 'down' };
    }

    return {
      ...base,
      status: classifyHttpStatus('backend', base.statusCode),
    };
  }

  // 5xx or any other non-200 (except 404) → DOWN, no fallback
  return { ...health, status: 'down' };
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

  await website.save();

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
