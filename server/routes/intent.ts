import { Router, Response } from 'express';
import { Intent, intents } from '../models/Intent';
import { generateId, generateQRCode } from '../utils/helpers';
import { verifyAuth, requireRole, AuthRequest } from '../middleware/auth';
import { inventory } from '../models/Inventory';
import { rewards, Reward } from '../models/Reward';

const router = Router();

/**
 * POST /api/intent
 * Submit e-waste disposal intent
 */
router.post('/', verifyAuth, requireRole('small_user'), async (req: AuthRequest, res: Response) => {
  try {
    const { items, location } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    const intent: Intent = {
      _id: generateId(),
      userId: req.user!.id,
      type: 'small_user',
      items: items.map(item => ({
        category: item.category,
        estimatedQty: item.estimatedQty,
        unit: item.unit,
        photos: item.photos || [],
        condition: item.condition,
        purchaseDate: item.purchaseDate,
      })),
      status: 'submitted',
      location: location || { lat: 0, lng: 0, address: '' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    intents.push(intent);

    // Create inventory items for each item in the intent
    for (const item of items) {
      const inventoryItem = {
        _id: generateId(),
        qrCode: generateQRCode(),
        intentId: intent._id,
        category: item.category,
        actualQty: item.estimatedQty,
        unit: item.unit,
        condition: item.condition || 'unknown',
        status: 'submitted' as const,
        sourceUserId: req.user!.id,
        verificationPhotos: item.photos || [],
        traceability: [
          {
            actor: req.user!.id,
            action: 'submitted',
            timestamp: new Date(),
            qrScanned: false,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inventory.push(inventoryItem as any);
    }

    res.status(201).json({
      message: 'Intent submitted successfully',
      intent,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/intent/collected-waste
 * Items submitted by this user that have been collected by a collector (small_user only)
 */
router.get('/collected-waste', verifyAuth, requireRole('small_user'), (req: AuthRequest, res: Response) => {
  try {
    const collected = inventory.filter(
      i => i.sourceUserId === req.user!.id && ['collected', 'at_hub', 'verified', 'matched', 'in_transit', 'delivered', 'processed'].includes(i.status)
    );
    res.json({ items: collected, total: collected.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/intent/:id
 * Track submission status
 */
router.get('/:id', verifyAuth, (req: AuthRequest, res: Response) => {
  try {
    const intent = intents.find(i => i._id === req.params.id);
    if (!intent) {
      return res.status(404).json({ error: 'Intent not found' });
    }

    // Check authorization
    if (intent.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get inventory items for this intent
    const inventoryItems = inventory.filter(i => i.intentId === intent._id);

    res.json({
      intent,
      inventoryItems,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/intent
 * Get all intents for current user
 */
router.get('/', verifyAuth, (req: AuthRequest, res: Response) => {
  try {
    let userIntents: Intent[];

    if (req.user!.role === 'small_user') {
      userIntents = intents.filter(i => i.userId === req.user!.id);
    } else if (req.user!.role === 'admin') {
      userIntents = intents;
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      intents: userIntents,
      total: userIntents.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/rewards
 * View points, badges, milestones + enriched history
 */
router.get('/rewards', verifyAuth, (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'small_user') {
      return res.status(403).json({ error: 'Only small users can access rewards' });
    }

    const reward = rewards.find(r => r.userId === req.user!.id);
    if (!reward) {
      return res.status(404).json({ error: 'Reward record not found' });
    }

    // Enrich history with inventory item info
    const enrichedHistory = reward.history.map(h => {
      const item = h.inventoryId ? inventory.find(i => i._id === h.inventoryId) : null;
      return {
        ...h,
        category: item?.category || null,
        quantity: item?.actualQty || null,
        unit: item?.unit || null,
      };
    }).reverse(); // newest first

    const tier =
      reward.totalPoints >= 5000 ? 'Platinum' :
      reward.totalPoints >= 1000 ? 'Gold' : 'Silver';

    const nextMilestone = reward.milestones.find(m => !m.reached);

    res.json({
      ...reward,
      enrichedHistory,
      tier,
      nextMilestone: nextMilestone ? {
        threshold: nextMilestone.threshold,
        pointsNeeded: Math.max(0, nextMilestone.threshold - reward.totalPoints),
        rewardType: nextMilestone.rewardType,
      } : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history
 * Past contributions
 */
router.get('/history', verifyAuth, (req: AuthRequest, res: Response) => {
  try {
    const userIntents = intents.filter(i => i.userId === req.user!.id);
    const inventoryItems = inventory.filter(i => i.sourceUserId === req.user!.id);

    res.json({
      intents: userIntents,
      inventory: inventoryItems,
      totalContributions: userIntents.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
