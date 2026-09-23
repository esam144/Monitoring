import jwt from 'jsonwebtoken';
import User from '../model/User.js';

/**
 * Auth for SSE / EventSource (Bearer header OR ?token=).
 */
const authStreamMiddleware = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token.toString();
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, token missing' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Not authorized, token invalid or expired' });
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth stream middleware error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

export default authStreamMiddleware;
