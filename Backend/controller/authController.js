import jwt from 'jsonwebtoken';
import User from '../model/User.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
};

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role || 'user',
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

/**
 * POST /auth/register
 * Bootstrap only: first user becomes admin.
 * Additional users must be created by an admin via POST /api/users.
 */
export const register = async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return res.status(403).json({
        message: 'Registration is closed. Ask an admin to create your account.',
      });
    }

    let { name, email, password } = req.body;

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

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: 'Password is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.create({
      name: name.trim(),
      email,
      password,
      role: 'admin',
    });

    const token = signToken(user._id);

    return res.status(201).json({
      message: 'Admin account created successfully',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Register error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /auth/login
 */
export const login = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required' });
    }

    email = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Email must have a valid format' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: 'Password is required' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user._id);

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /auth/me — protected
 */
export const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      user: sanitizeUser(req.user),
    });
  } catch (error) {
    console.error('Get me error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /auth/logout
 */
export const logout = async (req, res) => {
  try {
    return res.status(200).json({
      message: 'Logged out successfully. Please discard the token on the client.',
    });
  } catch (error) {
    console.error('Logout error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};
