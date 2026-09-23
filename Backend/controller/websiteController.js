import mongoose from 'mongoose';
import Website from '../model/Website.js';
import MonitorCheck from '../model/MonitorCheck.js';
import { checkWebsite } from '../services/monitoringService.js';
import { computeNextCheckAt, parseCheckInterval } from '../utils/interval.js';

const isValidUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const parseBoolean = (value, fieldName) => {
  if (typeof value === 'boolean') return { value };
  return { error: `${fieldName} must be a boolean` };
};

const populateWebsite = (query) =>
  query
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

const runImmediateCheck = async (website) => {
  try {
    await checkWebsite(website);
  } catch (error) {
    console.error(
      `[MONITOR] Immediate check failed for ${website.name}:`,
      error.message
    );
  }
};

/**
 * POST /api/websites
 */
export const createWebsite = async (req, res) => {
  try {
    const {
      name,
      type,
      url,
      active,
      monitoringEnabled,
      checkInterval,
      checkIntervalUnit,
    } = req.body;

    // Ignore any client-supplied createdBy / updatedBy
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!type || !['frontend', 'backend'].includes(type)) {
      return res.status(400).json({ message: 'Type must be frontend or backend' });
    }

    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ message: 'URL is required' });
    }

    if (!isValidUrl(url.trim())) {
      return res.status(400).json({ message: 'URL must be a valid http or https address' });
    }

    const intervalParsed = parseCheckInterval(
      checkInterval === undefined ? 5 : checkInterval,
      checkIntervalUnit === undefined ? 'minutes' : checkIntervalUnit
    );
    if (intervalParsed.error) {
      return res.status(400).json({ message: intervalParsed.error });
    }

    const payload = {
      name: name.trim(),
      type,
      url: url.trim(),
      checkInterval: intervalParsed.value,
      checkIntervalUnit: intervalParsed.unit,
      lastStatus: 'unknown',
      nextCheckAt: null,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    };

    if (active !== undefined) {
      const parsed = parseBoolean(active, 'active');
      if (parsed.error) return res.status(400).json({ message: parsed.error });
      payload.active = parsed.value;
    }

    if (monitoringEnabled !== undefined) {
      const parsed = parseBoolean(monitoringEnabled, 'monitoringEnabled');
      if (parsed.error) return res.status(400).json({ message: parsed.error });
      payload.monitoringEnabled = parsed.value;
    }

    let website = await Website.create(payload);

    if (website.monitoringEnabled) {
      await runImmediateCheck(website);
    }

    website = await populateWebsite(Website.findById(website._id));

    return res.status(201).json({
      message: 'Website added successfully',
      website,
    });
  } catch (error) {
    console.error('Create website error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/websites?page=1&limit=20&status=all|up|down
 * Server-side pagination via MongoDB skip/limit (not in-memory slice).
 */
export const getWebsites = async (req, res) => {
  try {
    const ALLOWED_STATUS = ['all', 'up', 'down'];
    const MAX_LIMIT = 100;
    const DEFAULT_LIMIT = 20;

    const statusFilter = (req.query.status || 'all').toString().toLowerCase();
    if (!ALLOWED_STATUS.includes(statusFilter)) {
      return res.status(400).json({
        message: 'status must be one of: all, up, down',
      });
    }

    const pageRaw = req.query.page === undefined ? 1 : Number(req.query.page);
    const limitRaw =
      req.query.limit === undefined ? DEFAULT_LIMIT : Number(req.query.limit);

    if (!Number.isInteger(pageRaw) || pageRaw < 1) {
      return res.status(400).json({ message: 'page must be an integer >= 1' });
    }

    if (!Number.isInteger(limitRaw) || limitRaw < 1) {
      return res.status(400).json({ message: 'limit must be an integer >= 1' });
    }

    if (limitRaw > MAX_LIMIT) {
      return res.status(400).json({
        message: `limit must be <= ${MAX_LIMIT}`,
      });
    }

    const limit = limitRaw;
    const filter = {};
    if (statusFilter === 'up' || statusFilter === 'down') {
      filter.lastStatus = statusFilter;
    }

    const totalItems = await Website.countDocuments(filter);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    // Clamp out-of-range pages to the last valid page (empty DB stays on page 1)
    let page = pageRaw;
    if (totalPages === 0) {
      page = 1;
    } else if (pageRaw > totalPages) {
      page = totalPages;
    }

    const skip = (page - 1) * limit;

    const websites = await populateWebsite(
      Website.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
    );

    return res.status(200).json({
      status: 'success',
      data: {
        websites,
        pagination: {
          page,
          currentPage: page,
          limit,
          total: totalItems,
          totalItems,
          totalPages,
          hasNextPage: totalPages > 0 && page < totalPages,
          hasPreviousPage: page > 1 && totalItems > 0,
        },
      },
    });
  } catch (error) {
    console.error('Get websites error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/websites/:id
 */
export const getWebsiteById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid website id' });
    }

    const website = await populateWebsite(Website.findById(id));

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    return res.status(200).json({ website });
  } catch (error) {
    console.error('Get website error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PUT /api/websites/:id
 * Any authenticated user may update any website (no ownership restriction).
 */
export const updateWebsite = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid website id' });
    }

    const website = await Website.findById(id);

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    const wasMonitoringEnabled = website.monitoringEnabled;
    const previousUrl = website.url;

    const {
      name,
      type,
      url,
      active,
      monitoringEnabled,
      checkInterval,
      checkIntervalUnit,
    } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Name cannot be empty' });
      }
      website.name = name.trim();
    }

    if (type !== undefined) {
      if (!['frontend', 'backend'].includes(type)) {
        return res.status(400).json({ message: 'Type must be frontend or backend' });
      }
      website.type = type;
    }

    if (url !== undefined) {
      if (typeof url !== 'string' || !url.trim() || !isValidUrl(url.trim())) {
        return res.status(400).json({ message: 'URL must be a valid http or https address' });
      }
      website.url = url.trim();
    }

    if (active !== undefined) {
      const parsed = parseBoolean(active, 'active');
      if (parsed.error) return res.status(400).json({ message: parsed.error });
      website.active = parsed.value;
    }

    if (monitoringEnabled !== undefined) {
      const parsed = parseBoolean(monitoringEnabled, 'monitoringEnabled');
      if (parsed.error) return res.status(400).json({ message: parsed.error });
      website.monitoringEnabled = parsed.value;
    }

    if (checkInterval !== undefined || checkIntervalUnit !== undefined) {
      const intervalParsed = parseCheckInterval(
        checkInterval !== undefined ? checkInterval : website.checkInterval,
        checkIntervalUnit !== undefined
          ? checkIntervalUnit
          : website.checkIntervalUnit || 'minutes'
      );
      if (intervalParsed.error) {
        return res.status(400).json({ message: intervalParsed.error });
      }
      website.checkInterval = intervalParsed.value;
      website.checkIntervalUnit = intervalParsed.unit;
    }

    // Never trust / change createdBy from the client
    website.updatedBy = req.user._id;

    if (website.monitoringEnabled === false) {
      website.nextCheckAt = null;
    }

    await website.save();

    const enabledJustNow =
      website.monitoringEnabled === true && wasMonitoringEnabled === false;
    const urlChangedWhileMonitoring =
      website.monitoringEnabled === true && website.url !== previousUrl;

    if (enabledJustNow || urlChangedWhileMonitoring) {
      await runImmediateCheck(website);
    } else if (
      website.monitoringEnabled &&
      (checkInterval !== undefined || checkIntervalUnit !== undefined) &&
      website.lastCheckedAt
    ) {
      // Recalculate next due time from last check when interval changes
      website.nextCheckAt = computeNextCheckAt(
        website.lastCheckedAt,
        website.checkInterval,
        website.checkIntervalUnit
      );
      await website.save();
    }

    const populated = await populateWebsite(Website.findById(website._id));

    return res.status(200).json({
      message: 'Website updated successfully',
      website: populated,
    });
  } catch (error) {
    console.error('Update website error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * DELETE /api/websites/:id
 * Any authenticated user may delete any website.
 */
export const deleteWebsite = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid website id' });
    }

    const website = await Website.findByIdAndDelete(id);

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    await MonitorCheck.deleteMany({ website: id });

    return res.status(200).json({
      message: 'Website removed from monitoring',
    });
  } catch (error) {
    console.error('Delete website error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};
