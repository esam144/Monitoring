/**
 * DEV ONLY Slack test routes — safe to delete this file later.
 */
import express from 'express';
import { testSlackAlert } from '../controller/devSlackController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.post('/slack-test', testSlackAlert);

export default router;
