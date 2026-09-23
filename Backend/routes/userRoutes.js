import express from 'express';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../controller/userController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import adminMiddleware from '../middleware/adminMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

// Any authenticated user can view the users table
router.get('/', listUsers);

// Only admin can create / edit / delete users
router.post('/', adminMiddleware, createUser);
router.put('/:id', adminMiddleware, updateUser);
router.delete('/:id', adminMiddleware, deleteUser);

export default router;
