import { Router } from 'express';
import { intents } from '../models/Intent';
import { generateId, generateQRCode, validateImageDataUrl } from '../utils/helpers';
import { verifyAuth, requireRole } from '../middleware/auth';
import { inventory } from '../models/Inventory';
import { rewards } from '../models/Reward';
import { users } from '../models/User';
import { haversineKm, sortByDistanceFrom } from '../utils/distance.js';
import { notify, notifyMany } from '../services/notificationService.js';
import { validate, intentSchema } from '../schemas.js';

const router = Router();

/**
 * POST /api/intent
 * Submit e-waste disposal intent. Notifies the nearest 3 active collectors.
 */
router.post('/', verifyAuth, requireRole('small_user'), validate(intentSchema), async (req, res) => {
  try {
    const { items, location } = req.body;

    // Per-photo image size + type check (each item's photos array)
    for (const it of items) {
      for (const p of it.photos || []) {
        const check = validateImageDataUrl(p, 5 * 1024 * 1024);
        if (!check.ok) return res.status(400).json({ error: check.error });
      }
    }

    const now = new Date().toISOString();

    // Location is optional — user may skip the map and just submit items.
    // Fall back to the user's saved profile address so collectors still see *something*.
    const sourceUser = users.find((u) => u._id === req.user.id);
    const locObj = location || {};
    const hasCoords = typeof locObj.lat === 'number' && typeof locObj.lng === 'number';
    const intentLocation = {
      lat: hasCoords ? locObj.lat : (sourceUser?.location?.lat ?? null),
      lng: hasCoords ? locObj.lng : (sourceUser?.location?.lng ?? null),
      address: locObj.address || sourceUser?.location?.address || '',
    };

    const intent = {
      _id: generateId(),
      userId: req.user.id,
      type: 'small_user',
      items: items.map((item) => ({
        category: item.category,
        estimatedQty: item.estimatedQty,
        unit: item.unit,
        photos: item.photos || [],
        condition: item.condition,
        purchaseDate: item.purchaseDate,
      })),
      status: 'submitted',
      location: intentLocation,
      createdAt: now,
      updatedAt: now,
    };
    intents.push(intent);

    // Create inventory rows for each item (sourceUser already resolved above)
    for (const item of items) {
      const invId = generateId();
      inventory.push({
        _id: invId,
        qrCode: generateQRCode(invId),
        intentId: intent._id,
        category: item.category,
        actualQty: item.estimatedQty,
        claimedQty: item.estimatedQty,
        unit: item.unit || 'pieces',
        weightKg: item.weightKg ?? null,
        condition: item.condition || 'unknown',
        status: 'submitted',
        sourceUserId: req.user.id,
        collectorId: null,
        hubId: null,
        deliveryWorkerId: null,
        recyclerId: null,
        matchedDemandId: null,
        verificationPhotos: item.photos || [],
        traceability: [
          {
            actor: req.user.id,
            actorName: sourceUser?.name || 'User',
            action: 'submitted',
            timestamp: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      });
    }

    // Notify collectors: nearest 3 if we have coords, otherwise broadcast to all active collectors.
    const activeCollectors = users.filter((u) => u.role === 'local_collector' && u.isActive);
    const hasIntentCoords = intent.location?.lat != null && intent.location?.lng != null;
    let recipients = [];
    let topThree = [];
    if (hasIntentCoords) {
      const ranked = sortByDistanceFrom(
        intent.location,
        activeCollectors.filter((c) => c.location?.lat != null),
        (c) => c.location
      );
      topThree = ranked.slice(0, 3);
      recipients = topThree.map((r) => r.item._id);
    }
    if (recipients.length === 0) {
      // No coords (or no collectors with coords) — notify everyone so the request isn't lost
      recipients = activeCollectors.map((c) => c._id);
    }

    const distanceHint = hasIntentCoords && topThree[0]
      ? ` ~${(topThree[0].distanceKm ?? 0).toFixed(1)} km from the nearest collector.`
      : '';

    notifyMany(recipients, {
      type: 'pickup_request',
      title: 'New e-waste pickup request',
      message: `${sourceUser?.name || 'A resident'} at ${intent.location.address || 'address not specified'} requested a pickup.${distanceHint}`,
      relatedId: intent._id,
    });

    res.status(201).json({
      message: hasIntentCoords
        ? 'Intent submitted. Nearest collectors have been notified.'
        : 'Intent submitted. All active collectors have been notified.',
      intent,
      notifiedCollectors: hasIntentCoords
        ? topThree.map((r) => ({
            id: r.item._id,
            name: r.item.name,
            distanceKm: Number(r.distanceKm.toFixed(2)),
          }))
        : recipients.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/intent/collected-waste
 */
router.get('/collected-waste', verifyAuth, requireRole('small_user'), (req, res) => {
  try {
    const collected = inventory.filter(
      (i) =>
        i.sourceUserId === req.user.id &&
        ['collected', 'at_hub', 'verified', 'matched', 'in_transit', 'delivered', 'processed'].includes(i.status)
    );
    res.json({ items: collected, total: collected.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/intent/:id
 */
router.get('/:id', verifyAuth, (req, res) => {
  try {
    const intent = intents.find((i) => i._id === req.params.id);
    if (!intent) return res.status(404).json({ error: 'Intent not found' });

    if (intent.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const inventoryItems = inventory.filter((i) => i.intentId === intent._id);
    res.json({ intent, inventoryItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/intent
 */
router.get('/', verifyAuth, (req, res) => {
  try {
    let userIntents;
    if (req.user.role === 'small_user') {
      userIntents = intents.filter((i) => i.userId === req.user.id);
    } else if (req.user.role === 'admin') {
      userIntents = intents;
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    // Enrich with assigned collector name
    const enriched = userIntents.map((it) => {
      const col = it.assignedCollector ? users.find((u) => u._id === it.assignedCollector) : null;
      return { ...it, collectorName: col?.name || null, collectorPhone: col?.phone || null };
    });
    res.json({ intents: enriched, total: enriched.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/intent/rewards  — small user wallet summary
 */
router.get('/rewards', verifyAuth, (req, res) => {
  try {
    if (req.user.role !== 'small_user') {
      return res.status(403).json({ error: 'Only small users can access rewards' });
    }
    const reward = rewards.find((r) => r.userId === req.user.id);
    if (!reward) return res.status(404).json({ error: 'Reward record not found' });

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

/**
 * GET /api/intent/history
 */
router.get('/history', verifyAuth, (req, res) => {
  try {
    const userIntents = intents.filter((i) => i.userId === req.user.id);
    const inventoryItems = inventory.filter((i) => i.sourceUserId === req.user.id);
    res.json({
      intents: userIntents,
      inventory: inventoryItems,
      totalContributions: userIntents.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
