import express from 'express';
import {
  createWebsite,
  getWebsites,
  getWebsiteById,
  updateWebsite,
  deleteWebsite,
  getSlackSettingsForWebsite,
  updateSlackSettingsForWebsite,
} from '../controller/websiteController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/', createWebsite);
router.get('/', getWebsites);

// Nested slack-settings before /:id so Express matches correctly
router.get('/:id/slack-settings', getSlackSettingsForWebsite);
router.put('/:id/slack-settings', updateSlackSettingsForWebsite);

router.get('/:id', getWebsiteById);
router.put('/:id', updateWebsite);
router.delete('/:id', deleteWebsite);

export default router;
