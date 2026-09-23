import User from '../model/User.js';
import Website from '../model/Website.js';
import { computeNextCheckAt } from '../utils/interval.js';

/**
 * One-time-ish startup migration for existing documents:
 * - Ensure at least one admin exists (promotes oldest user if needed)
 * - Backfill website checkIntervalUnit / nextCheckAt / createdBy / updatedBy
 */
export const migrateMonitoringData = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[MIGRATE] No users yet — skip website backfill');
      return;
    }

    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      const oldest = await User.findOne().sort({ createdAt: 1 });
      if (oldest) {
        oldest.role = 'admin';
        await oldest.save();
        console.log(`[MIGRATE] Promoted ${oldest.email} to admin`);
      }
    }

    const fallbackUser =
      (await User.findOne({ role: 'admin' }).sort({ createdAt: 1 })) ||
      (await User.findOne().sort({ createdAt: 1 }));

    if (!fallbackUser) return;

    const websites = await Website.find({});
    let updated = 0;

    for (const site of websites) {
      let dirty = false;

      if (!site.checkIntervalUnit) {
        // Legacy docs used hour-based 6/12 intervals
        site.checkIntervalUnit = 'hours';
        dirty = true;
      }

      if (!site.checkInterval || Number(site.checkInterval) < 1) {
        site.checkInterval = 5;
        site.checkIntervalUnit = 'minutes';
        dirty = true;
      }

      if (!site.createdBy) {
        site.createdBy = fallbackUser._id;
        dirty = true;
      }

      if (!site.updatedBy) {
        site.updatedBy = site.createdBy || fallbackUser._id;
        dirty = true;
      }

      if (site.monitoringEnabled) {
        if (!site.nextCheckAt) {
          if (site.lastCheckedAt) {
            site.nextCheckAt = computeNextCheckAt(
              site.lastCheckedAt,
              site.checkInterval,
              site.checkIntervalUnit
            );
          } else {
            site.nextCheckAt = new Date(); // due immediately
          }
          dirty = true;
        }
      } else if (site.nextCheckAt) {
        site.nextCheckAt = null;
        dirty = true;
      }

      if (dirty) {
        await site.save();
        updated += 1;
      }
    }

    if (updated > 0) {
      console.log(`[MIGRATE] Updated ${updated} website document(s)`);
    }
  } catch (error) {
    console.error('[MIGRATE] Failed:', error.message);
  }
};
