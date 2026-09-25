import mongoose from 'mongoose';
import Website from '../model/Website.js';
import MonitorCheck from '../model/MonitorCheck.js';
import { parseTimeRange } from '../utils/timeRange.js';
import { checkWebsite } from '../services/monitoringService.js';
import { isSlackConfigured } from '../services/slackService.js';
import {
  addLiveClient,
  removeLiveClient,
} from '../services/monitoringEvents.js';

const round = (value, decimals = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Number(Number(value).toFixed(decimals));
};

/**
 * GET /api/monitoring/overview?range=24h
 * Pie-chart stats derived from historical MonitorCheck records.
 */
export const getOverview = async (req, res) => {
  try {
    const parsed = parseTimeRange(req.query.range);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const { startDate, range } = parsed;
    const websites = await Website.find({ monitoringEnabled: true }).select('_id');
    const totalWebsites = websites.length;
    const websiteIds = websites.map((w) => w._id);

    if (totalWebsites === 0) {
      return res.status(200).json({
        range,
        totalWebsites: 0,
        upWebsites: 0,
        downWebsites: 0,
        uptimePercentage: 0,
      });
    }

    const [totals] = await MonitorCheck.aggregate([
      {
        $match: {
          website: { $in: websiteIds },
          checkedAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalChecks: { $sum: 1 },
          upChecks: {
            $sum: { $cond: [{ $eq: ['$status', 'up'] }, 1, 0] },
          },
        },
      },
    ]);

    const totalChecks = totals?.totalChecks || 0;
    const upChecks = totals?.upChecks || 0;
    const uptimePercentage =
      totalChecks === 0 ? 0 : round((upChecks / totalChecks) * 100);

    const latestChecks = await MonitorCheck.aggregate([
      {
        $match: {
          website: { $in: websiteIds },
          checkedAt: { $gte: startDate },
        },
      },
      { $sort: { checkedAt: -1 } },
      {
        $group: {
          _id: '$website',
          status: { $first: '$status' },
        },
      },
    ]);

    let upWebsites = 0;
    let downWebsites = 0;

    for (const item of latestChecks) {
      if (item.status === 'up') upWebsites += 1;
      else downWebsites += 1;
    }

    // Websites with no checks in range count as down for the pie chart
    downWebsites += totalWebsites - latestChecks.length;

    return res.status(200).json({
      range,
      totalWebsites,
      upWebsites,
      downWebsites,
      uptimePercentage,
    });
  } catch (error) {
    console.error('Overview error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/monitoring/stats?range=24h
 * Per-website stats for histogram/bar charts (from history).
 */
export const getStats = async (req, res) => {
  try {
    const parsed = parseTimeRange(req.query.range);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const { startDate, range } = parsed;
    const websites = await Website.find({ monitoringEnabled: true }).sort({ name: 1 });
    if (websites.length === 0) {
      return res.status(200).json({ range, stats: [] });
    }

    const websiteIds = websites.map((w) => w._id);

    const aggregated = await MonitorCheck.aggregate([
      {
        $match: {
          website: { $in: websiteIds },
          checkedAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$website',
          totalChecks: { $sum: 1 },
          upChecks: {
            $sum: { $cond: [{ $eq: ['$status', 'up'] }, 1, 0] },
          },
          downCount: {
            $sum: { $cond: [{ $eq: ['$status', 'down'] }, 1, 0] },
          },
          avgResponseTime: { $avg: '$responseTime' },
        },
      },
    ]);

    const statsById = new Map(
      aggregated.map((row) => [row._id.toString(), row])
    );

    const stats = websites.map((website) => {
      const row = statsById.get(website._id.toString());
      const totalChecks = row?.totalChecks || 0;
      const upChecks = row?.upChecks || 0;
      const downCount = row?.downCount || 0;
      const uptimePercentage =
        totalChecks === 0 ? 0 : round((upChecks / totalChecks) * 100);

      return {
        websiteId: website._id,
        name: website.name,
        type: website.type,
        uptimePercentage,
        downCount,
        averageResponseTime: round(row?.avgResponseTime ?? 0, 2),
      };
    });

    return res.status(200).json({ range, stats });
  } catch (error) {
    console.error('Stats error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/monitoring/history/:websiteId?range=24h&page=1&limit=8
 * Server-side pagination for check history.
 */
export const getHistory = async (req, res) => {
  try {
    const { websiteId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(websiteId)) {
      return res.status(400).json({ message: 'Invalid website id' });
    }

    const parsed = parseTimeRange(req.query.range);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const { startDate, range } = parsed;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitRaw = parseInt(req.query.limit, 10) || 8;
    const limit = Math.min(100, Math.max(1, limitRaw));
    const skip = (page - 1) * limit;

    const website = await Website.findById(websiteId).select('name type url');
    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    const filter = {
      website: websiteId,
      checkedAt: { $gte: startDate },
    };

    const [total, history] = await Promise.all([
      MonitorCheck.countDocuments(filter),
      MonitorCheck.find(filter)
        .sort({ checkedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('checkedAt status responseTime statusCode websiteName websiteUrl -_id'),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).json({
      range,
      website: {
        id: website._id,
        name: website.name,
        type: website.type,
        url: website.url,
      },
      count: history.length,
      history: history.map((item) => ({
        checkedAt: item.checkedAt,
        status: item.status,
        responseTime: item.responseTime,
        statusCode: item.statusCode,
        websiteName: item.websiteName,
        websiteUrl: item.websiteUrl,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('History error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /monitoring/check/:websiteId
 * Immediate one-off health check (does not require monitoringEnabled).
 */
export const checkWebsiteNow = async (req, res) => {
  try {
    const { websiteId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(websiteId)) {
      return res.status(400).json({ message: 'Invalid website id' });
    }

    const website = await Website.findById(websiteId);
    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    const result = await checkWebsite(website);

    if (result?.skipped) {
      return res.status(200).json({
        message: 'A check is already in progress for this website',
        result,
      });
    }

    const message =
      result.status === 'up'
        ? 'Website checked successfully'
        : 'Website check completed';

    return res.status(200).json({
      message,
      result,
    });
  } catch (error) {
    console.error('Manual check error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/monitoring/slack-status
 * Safe status only — never returns tokens or channel IDs.
 */
export const getSlackStatus = async (req, res) => {
  try {
    const configured = isSlackConfigured();
    return res.status(200).json({
      configured,
      channelConfigured: Boolean(process.env.SLACK_CHANNEL_ID?.trim()),
      tokenConfigured: Boolean(process.env.SLACK_BOT_TOKEN?.trim()),
    });
  } catch (error) {
    console.error('Slack status error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/monitoring/stream?websiteId=&token=
 * SSE live feed. Optional websiteId filters to one site (per-site terminal).
 */
export const streamLiveLogs = async (req, res) => {
  try {
    const websiteId = req.query.websiteId
      ? req.query.websiteId.toString()
      : null;

    if (websiteId && !mongoose.Types.ObjectId.isValid(websiteId)) {
      return res.status(400).json({ message: 'Invalid websiteId' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    res.write(`event: connected\n`);
    res.write(
      `data: ${JSON.stringify({
        type: 'connected',
        websiteId,
        message: websiteId
          ? 'Live monitor connected'
          : 'Live monitoring connected',
        emittedAt: new Date().toISOString(),
      })}\n\n`
    );

    addLiveClient(res, websiteId);

    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeLiveClient(res);
    });
  } catch (error) {
    console.error('SSE stream error:', error.message);
    removeLiveClient(res);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Server error' });
    }
  }
};
