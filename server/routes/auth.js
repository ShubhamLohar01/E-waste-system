import { Router } from 'express';
import { users } from '../models/User';
import { hashPassword, comparePassword, generateId } from '../utils/helpers';
import {
  generateToken,
  generateVerificationToken,
  verifyVerificationToken,
  verifyAuth,
} from '../middleware/auth';
import {
  setEmailCode,
  verifyEmailCode,
  sendVerificationEmail,
} from '../utils/verification';
import { rewards } from '../models/Reward';

const router = Router();

const trustLevelMap = {
  small_user: 'low',
  local_collector: 'medium',
  hub: 'high',
  delivery_worker: 'low',
  recycler: 'high',
  bulk_generator: 'high',
  admin: 'highest',
};

/**
 * POST /api/auth/send-email-code
 * Send verification code to email (Gmail); code is emailed or logged in dev
 */
router.post('/send-email-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Email required' });
    }
    const code = setEmailCode(email);
    const { sent, error } = await sendVerificationEmail(email, code);
    if (!sent) {
      return res.status(500).json({ success: false, error: error || 'Failed to send code' });
    }
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/auth/verify-email-code
 * Verify email code and return token+user if existing user, else needsRegister + verifyToken
 */
router.post('/verify-email-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!verifyEmailCode(normalizedEmail, code)) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }
    const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (user) {
      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is disabled' });
      }
      const token = generateToken({
        id: user._id,
        email: user.email,
        role: user.role,
      });
      return res.json({
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          trustLevel: user.trustLevel,
        },
      });
    }
    const verifyToken = generateVerificationToken({
      email: normalizedEmail,
      purpose: 'email_register',
    });
    return res.json({ needsRegister: true, verifyToken });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/auth/register-with-email
 * Register after email code verified; requires verifyToken from verify-email-code
 */
router.post('/register-with-email', async (req, res) => {
  try {
    const { verifyToken, name, role, address } = req.body;
    if (!verifyToken || !name || !role) {
      return res.status(400).json({ error: 'verifyToken, name and role required' });
    }
    if (!address || typeof address !== 'string' || !address.trim()) {
      return res.status(400).json({ error: 'Address is required' });
    }
    const payload = verifyVerificationToken(verifyToken);
    if (!payload || payload.purpose !== 'email_register' || !payload.email) {
      return res.status(400).json({ error: 'Invalid or expired verification' });
    }
    const email = payload.email;
    if (users.some((u) => u.email.toLowerCase() === email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const randomPassword = await hashPassword(generateId() + Date.now());
    const user = {
      _id: generateId(),
      name: name.trim(),
      email,
      password: randomPassword,
      phone: '',
      role: role,
      trustLevel: trustLevelMap[role] || 'low',
      location: { lat: 0, lng: 0, address: address.trim() },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.push(user);
    if (role === 'small_user') {
      const reward = {
        _id: generateId(),
        userId: user._id,
        totalPoints: 0,
        currentStreak: 0,
        badges: [],
        milestones: [
          { threshold: 1000, reached: false, rewardType: 'silver_badge' },
          { threshold: 5000, reached: false, rewardType: 'gold_badge' },
          { threshold: 10000, reached: false, rewardType: 'platinum_badge' },
        ],
        history: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rewards.push(reward);
    }
    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });
    return res.status(201).json({
      message: 'Registered successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        trustLevel: user.trustLevel,
        location: user.location,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role, location } = req.body;

    // Validate input
    if (!name || !email || !password || !phone || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already exists
    if (users.find(u => u.email === email)) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = {
      _id: generateId(),
      name,
      email,
      password: hashedPassword,
      phone,
      role: role,
      trustLevel: trustLevelMap[role] || 'low',
      location: location || { lat: 0, lng: 0, address: '' },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    users.push(user);

    // Create reward record for small users
    if (role === 'small_user') {
      const reward = {
        _id: generateId(),
        userId: user._id,
        totalPoints: 0,
        currentStreak: 0,
        badges: [],
        milestones: [
          { threshold: 1000, reached: false, rewardType: 'silver_badge' },
          { threshold: 5000, reached: false, rewardType: 'gold_badge' },
          { threshold: 10000, reached: false, rewardType: 'platinum_badge' },
        ],
        history: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rewards.push(reward);
    }

    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        trustLevel: user.trustLevel,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/login
 * Login user and return JWT
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatch = await comparePassword(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'User account is disabled' });
    }

    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        trustLevel: user.trustLevel,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/google
 * Sign in or sign up with Google (id_token from Google Identity Services)
 */
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ error: 'Google credential (id_token) required' });
    }
    const tokenRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!tokenRes.ok) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }
    const payload = await tokenRes.json();
    const email = payload.email?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email not provided by Google' });
    }
    let user = users.find((u) => u.email.toLowerCase() === email);
    if (user) {
      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is disabled' });
      }
    } else {
      user = {
        _id: generateId(),
        name: payload.name || email.split('@')[0],
        email,
        password: '', // no password for Google users
        phone: '',
        role: 'small_user',
        trustLevel: 'low',
        location: { lat: 0, lng: 0, address: '' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.push(user);
      const reward = {
        _id: generateId(),
        userId: user._id,
        totalPoints: 0,
        currentStreak: 0,
        badges: [],
        milestones: [
          { threshold: 1000, reached: false, rewardType: 'silver_badge' },
          { threshold: 5000, reached: false, rewardType: 'gold_badge' },
          { threshold: 10000, reached: false, rewardType: 'platinum_badge' },
        ],
        history: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rewards.push(reward);
    }
    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });
    return res.json({
      message: 'Signed in with Google',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        trustLevel: user.trustLevel,
        location: user.location,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', verifyAuth, (req, res) => {
  try {
    const user = users.find(u => u._id === req.user?.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      trustLevel: user.trustLevel,
      location: user.location,
      isActive: user.isActive,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', verifyAuth, async (req, res) => {
  try {
    const user = users.find(u => u._id === req.user?.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, phone, location } = req.body;

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (location) user.location = location;
    user.updatedAt = new Date();

    res.json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        location: user.location,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
