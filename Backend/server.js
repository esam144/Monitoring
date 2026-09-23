import 'dotenv/config';
import express from 'express';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import websiteRoutes from './routes/websiteRoutes.js';
import monitoringRoutes from './routes/monitoringRoutes.js';
import userRoutes from './routes/userRoutes.js';
import devSlackRoutes from './routes/devSlackRoutes.js';
import { startMonitoringScheduler } from './services/monitoringScheduler.js';
import { migrateMonitoringData } from './utils/migrate.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/users', userRoutes);

// DEV ONLY — enabled solely when ENABLE_SLACK_TEST=true
if (process.env.ENABLE_SLACK_TEST === 'true') {
  app.use('/api/monitoring/dev', devSlackRoutes);
  console.log(
    '[DEV] Slack test endpoint enabled: POST /api/monitoring/dev/slack-test'
  );
}

const startServer = async () => {
  await connectDB();
  await migrateMonitoringData();
  startMonitoringScheduler();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();
