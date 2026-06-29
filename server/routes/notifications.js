import { Router } from 'express';
import { notifications } from '../models/Notification.js';
import { verifyAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/notifications — my notifications, newest first
 */
router.get('/', verifyAuth, (req, res) => {
  try {
    const mine = notifications
      .filter((n) => n.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 100);
    const unread = mine.filter((n) => !n.read).length;
    res.json({ notifications: mine, unread });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/read-all
 */
router.post('/read-all', verifyAuth, (req, res) => {
  try {
    let count = 0;
    for (const n of notifications) {
      if (n.userId === req.user.id && !n.read) {
        n.read = true;
        count++;
      }
    }
    res.json({ message: 'Marked as read', count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/:id/read
 */
router.post('/:id/read', verifyAuth, (req, res) => {
  try {
    const n = notifications.find((x) => x._id === req.params.id && x.userId === req.user.id);
    if (!n) return res.status(404).json({ error: 'Notification not found' });
    n.read = true;
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
