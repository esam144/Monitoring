/**
 * Rewrite MonitorCheck docs so field order is:
 * _id, website, websiteName, websiteUrl, status, responseTime, statusCode, checkedAt, __v
 *
 * Usage: node scripts/reorderMonitorCheckFields.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import MonitorCheck from '../model/MonitorCheck.js';

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not defined');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected. Reordering MonitorCheck fields…');

  const checks = await MonitorCheck.find({}).lean();
  console.log(`Found ${checks.length} document(s).`);

  let updated = 0;

  for (const row of checks) {
    const next = {
      _id: row._id,
      website: row.website,
      websiteName: row.websiteName ?? null,
      websiteUrl: row.websiteUrl ?? null,
      status: row.status,
      responseTime: row.responseTime ?? null,
      statusCode: row.statusCode ?? null,
      checkedAt: row.checkedAt,
      __v: row.__v ?? 0,
    };

    await MonitorCheck.collection.replaceOne({ _id: row._id }, next);
    updated += 1;
  }

  console.log(`Done. Reordered: ${updated}.`);
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
