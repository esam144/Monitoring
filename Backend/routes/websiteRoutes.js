import express from 'express';
import {
  createWebsite,
  getWebsites,
  getWebsiteById,
  updateWebsite,
  deleteWebsite,
} from '../controller/websiteController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/', createWebsite);
router.get('/', getWebsites);
router.get('/:id', getWebsiteById);
router.put('/:id', updateWebsite);
router.delete('/:id', deleteWebsite);

export default router;
