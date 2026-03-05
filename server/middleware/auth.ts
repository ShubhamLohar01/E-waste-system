import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

export interface VerificationTokenPayload {
  phone?: string;
  email?: string;
  purpose: 'phone_register' | 'email_register';
}

/**
 * Generate JWT token for a user
 */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verify JWT token from request headers
 */
export function verifyAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Check if user has one of the required roles
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
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
export function generateVerificationToken(payload: VerificationTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });
}

/**
 * Verify verification token (for register-with-phone / register-with-email)
 */
export function verifyVerificationToken(token: string): VerificationTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as VerificationTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
}
