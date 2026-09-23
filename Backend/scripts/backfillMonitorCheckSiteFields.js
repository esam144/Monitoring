/**
 * One-time backfill: set websiteName + websiteUrl on MonitorCheck docs
 * that are missing them (looks up Website by ObjectId).
 *
 * Usage: node scripts/backfillMonitorCheckSiteFields.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Website from '../model/Website.js';
import MonitorCheck from '../model/MonitorCheck.js';

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not defined');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected. Backfilling MonitorCheck websiteName/websiteUrl…');

  const websites = await Website.find({}).select('_id name url').lean();
  const byId = new Map(websites.map((w) => [String(w._id), w]));

  const missing = await MonitorCheck.find({
    $or: [
      { websiteName: { $exists: false } },
      { websiteName: null },
      { websiteUrl: { $exists: false } },
      { websiteUrl: null },
      { websiteName: '' },
      { websiteUrl: '' },
    ],
  })
    .select('_id website')
    .lean();

  console.log(`Found ${missing.length} check(s) to update.`);

  let updated = 0;
  let skipped = 0;

  for (const row of missing) {
    const site = byId.get(String(row.website));
    if (!site) {
      skipped += 1;
      continue;
    }
    await MonitorCheck.updateOne(
      { _id: row._id },
      {
        $set: {
          websiteName: site.name,
          websiteUrl: site.url,
        },
      }
    );
    updated += 1;
  }

  console.log(`Done. Updated: ${updated}. Skipped (no website): ${skipped}.`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
