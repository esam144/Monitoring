import express from 'express';
import {
  getOverview,
  getStats,
  getHistory,
  checkWebsiteNow,
  getSlackStatus,
  streamLiveLogs,
} from '../controller/monitoringController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import authStreamMiddleware from '../middleware/authStreamMiddleware.js';

const router = express.Router();

router.get('/stream', authStreamMiddleware, streamLiveLogs);

router.use(authMiddleware);

router.get('/overview', getOverview);
router.get('/stats', getStats);
router.get('/slack-status', getSlackStatus);
router.get('/history/:websiteId', getHistory);
router.post('/check/:websiteId', checkWebsiteNow);

export default router;
