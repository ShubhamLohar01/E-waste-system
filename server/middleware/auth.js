import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Generate JWT token for a user
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verify JWT token from request headers
 */
export function verifyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Check if user has one of the required roles
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this role' });
    }

    next();
  };
}

/**
 * Generate short-lived JWT for phone/email registration (after OTP/code verified)
 */
export function generateVerificationToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });
}

/**
 * Verify verification token (for register-with-phone / register-with-email)
 */
export function verifyVerificationToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
}
