import mongoose from 'mongoose';
import User from '../model/User.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

/**
 * GET /api/users — admin only
 */
export const listUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    return res.status(200).json({
      count: users.length,
      users: users.map(sanitizeUser),
    });
  } catch (error) {
    console.error('List users error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /api/users — admin creates a user
 */
export const createUser = async (req, res) => {
  try {
    let { name, email, password, role } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required' });
    }

    email = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Email must have a valid format' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        message: 'Password is required and must be at least 6 characters',
      });
    }

    const nextRole = role === 'admin' ? 'admin' : 'user';

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Unable to create account with that email' });
    }

    const user = await User.create({
      name: name.trim(),
      email,
      password,
      role: nextRole,
    });

    return res.status(201).json({
      message: 'User created successfully',
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Create user error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PUT /api/users/:id — admin updates name/role/password
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await User.findById(id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, role, password } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Name cannot be empty' });
      }
      user.name = name.trim();
    }

    if (role !== undefined) {
      if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ message: 'Role must be admin or user' });
      }
      // Prevent removing the last admin
      if (user.role === 'admin' && role === 'user') {
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount <= 1) {
          return res.status(400).json({
            message: 'Cannot demote the last admin',
          });
        }
      }
      user.role = role;
    }

    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({
          message: 'Password must be at least 6 characters',
        });
      }
      user.password = password;
    }

    await user.save();

    return res.status(200).json({
      message: 'User updated successfully',
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Update user error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * DELETE /api/users/:id — admin only
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (req.user._id.toString() === id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last admin' });
      }
    }

    await User.findByIdAndDelete(id);

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};
