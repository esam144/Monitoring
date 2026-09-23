import { api } from './axios';

export const getOverview = (range = '24h') =>
  api.get('/monitoring/overview', { params: { range } });

export const getStats = (range = '24h') =>
  api.get('/monitoring/stats', { params: { range } });

export const getHistory = (websiteId, range = '24h', page = 1, limit = 8) =>
  api.get(`/monitoring/history/${websiteId}`, {
    params: { range, page, limit },
  });

export const checkWebsiteNow = (websiteId) =>
  api.post(`/monitoring/check/${websiteId}`);

/** Safe Slack config flag — never returns secrets */
export const getSlackStatus = () => api.get('/monitoring/slack-status');

/**
 * SSE live feed for one site (EventSource uses ?token=).
 */
export const openSiteMonitoringStream = (
  token,
  websiteId,
  { onEvent, onError, onOpen } = {}
) => {
  const params = new URLSearchParams({
    token,
    websiteId: String(websiteId),
  });
  const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
  const source = new EventSource(
    `${apiBase}/monitoring/stream?${params.toString()}`
  );

  const handle = (event) => {
    try {
      onEvent?.(JSON.parse(event.data));
    } catch {
      // ignore
    }
  };

  source.addEventListener('connected', handle);
  source.addEventListener('check_started', handle);
  source.addEventListener('check_completed', handle);
  source.addEventListener('alert', handle);
  source.onmessage = handle;
  if (onOpen) source.onopen = onOpen;
  if (onError) source.onerror = onError;

  return source;
};
