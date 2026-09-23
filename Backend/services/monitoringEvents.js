/**
 * In-memory SSE hub for live per-site monitoring events.
 * Monitoring continues even when nobody is watching.
 */

const clients = new Set();

/**
 * @param {import('express').Response} res
 * @param {string|null} websiteId - if set, only events for this site are sent
 */
export const addLiveClient = (res, websiteId = null) => {
  clients.add({ res, websiteId: websiteId ? String(websiteId) : null });
};

/**
 * @param {import('express').Response} res
 */
export const removeLiveClient = (res) => {
  for (const client of clients) {
    if (client.res === res) clients.delete(client);
  }
};

/**
 * @param {string} eventType
 * @param {object} payload - should include websiteId when site-specific
 */
export const broadcastMonitoringEvent = (eventType, payload) => {
  if (clients.size === 0) return;

  // `type` must be the event name — never overwritten by payload fields
  // (e.g. siteType for frontend|backend).
  const { type: _ignored, ...safePayload } = payload || {};
  void _ignored;

  const data = JSON.stringify({
    ...safePayload,
    type: eventType,
    emittedAt: new Date().toISOString(),
  });

  const eventWebsiteId =
    safePayload.websiteId != null ? String(safePayload.websiteId) : null;

  for (const client of clients) {
    try {
      if (client.websiteId && eventWebsiteId && client.websiteId !== eventWebsiteId) {
        continue;
      }
      client.res.write(`event: ${eventType}\n`);
      client.res.write(`data: ${data}\n\n`);
    } catch {
      clients.delete(client);
    }
  }
};
