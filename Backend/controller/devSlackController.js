import mongoose from 'mongoose';
import Website from '../model/Website.js';
import {
  evaluateStatusAlert,
  flushPendingDownAlerts,
} from '../services/alertService.js';

/**
 * DEV ONLY — POST /api/monitoring/dev/slack-test
 * Triggers Slack via existing evaluateStatusAlert transition logic.
 * Delete this controller + route when done testing.
 *
 * Body (single):
 *   { "websiteId": "...", "alertType": "down" | "recovery" }
 *
 * Body (combined DOWN test):
 *   { "websiteIds": ["id1", "id2", "id3"], "alertType": "down" }
 */
export const testSlackAlert = async (req, res) => {
  try {
    const { alertType } = req.body || {};
    let { statusCode, responseTime } = req.body || {};

    const websiteIdsRaw = Array.isArray(req.body?.websiteIds)
      ? req.body.websiteIds
      : req.body?.websiteId
        ? [req.body.websiteId]
        : [];

    if (websiteIdsRaw.length === 0) {
      return res.status(400).json({
        message: 'Provide websiteId or websiteIds[]',
      });
    }

    if (!['down', 'recovery'].includes(alertType)) {
      return res.status(400).json({
        message: 'alertType must be "down" or "recovery"',
      });
    }

    if (alertType === 'recovery' && websiteIdsRaw.length > 1) {
      return res.status(400).json({
        message:
          'RECOVERY is per-site. Send one request per websiteId (not a batch).',
      });
    }

    for (const id of websiteIdsRaw) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: `Invalid websiteId: ${id}` });
      }
    }

    if (statusCode !== undefined && statusCode !== null && statusCode !== '') {
      statusCode = Number(statusCode);
      if (!Number.isInteger(statusCode)) {
        return res.status(400).json({ message: 'statusCode must be an integer' });
      }
    } else {
      statusCode = alertType === 'down' ? 500 : 200;
    }

    if (responseTime !== undefined && responseTime !== null && responseTime !== '') {
      responseTime = Number(responseTime);
      if (!Number.isFinite(responseTime)) {
        return res.status(400).json({ message: 'responseTime must be a number' });
      }
    } else {
      responseTime = 100;
    }

    const checkedAt = new Date();
    const checkMeta = { statusCode, responseTime, checkedAt };
    const results = [];

    for (const id of websiteIdsRaw) {
      const website = await Website.findById(id);
      if (!website) {
        return res.status(404).json({ message: `Website not found: ${id}` });
      }

      if (alertType === 'down') {
        website.lastAlertStatus = 'up';
        const { alertType: fired } = await evaluateStatusAlert(
          website,
          'down',
          checkMeta
        );
        if (fired !== 'down') {
          return res.status(500).json({
            message: `Failed to trigger DOWN transition for ${website.name}`,
          });
        }
        website.lastStatus = 'down';
      } else {
        website.lastAlertStatus = 'down';
        const { alertType: fired } = await evaluateStatusAlert(
          website,
          'up',
          checkMeta
        );
        if (fired !== 'recovery') {
          return res.status(500).json({
            message: `Failed to trigger RECOVERY transition for ${website.name}`,
          });
        }
        website.lastStatus = 'up';
      }

      website.lastCheckedAt = checkedAt;
      website.lastResponseTime = responseTime;
      await website.save();

      results.push({
        id: website._id,
        name: website.name,
        url: website.url,
        type: website.type,
        lastAlertStatus: website.lastAlertStatus,
      });
    }

    // Flush immediately so Postman tests don't wait for the 500ms debounce
    let flush = null;
    if (alertType === 'down') {
      flush = await flushPendingDownAlerts();
    }

    return res.status(200).json({
      message:
        alertType === 'down'
          ? results.length > 1
            ? `Batched Slack DOWN alert queued for ${results.length} websites`
            : 'Slack DOWN alert triggered via transition logic'
          : 'Slack RECOVERY alert triggered via transition logic',
      alertType,
      websites: results,
      flush,
      note:
        alertType === 'down'
          ? 'DOWN alerts are combined into one Slack message'
          : 'RECOVERY alerts are sent one message per website',
    });
  } catch (error) {
    console.error('Dev Slack test error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};
