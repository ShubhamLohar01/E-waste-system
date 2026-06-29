import { Router } from 'express';
import { rewards } from '../models/Reward.js';
import { inventory } from '../models/Inventory.js';
import { verifyAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/rewards/mine — any authenticated user can check their reward counter
 */
router.get('/mine', verifyAuth, (req, res) => {
  try {
    const reward = rewards.find((r) => r.userId === req.user.id);
    if (!reward) {
      return res.json({
        totalPoints: 0,
        currentStreak: 0,
        badges: [],
        milestones: [],
        enrichedHistory: [],
        tier: 'Silver',
      });
    }
    const enrichedHistory = reward.history
      .map((h) => {
        const item = h.inventoryId ? inventory.find((i) => i._id === h.inventoryId) : null;
        return {
          ...h,
          category: item?.category || null,
          quantity: item?.actualQty || null,
          unit: item?.unit || null,
        };
      })
      .reverse();
    const tier =
      reward.totalPoints >= 5000 ? 'Platinum' : reward.totalPoints >= 1000 ? 'Gold' : 'Silver';
    const nextMilestone = reward.milestones.find((m) => !m.reached);
    res.json({
      ...reward,
      enrichedHistory,
      tier,
      nextMilestone: nextMilestone
        ? {
            threshold: nextMilestone.threshold,
            pointsNeeded: Math.max(0, nextMilestone.threshold - reward.totalPoints),
            rewardType: nextMilestone.rewardType,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
