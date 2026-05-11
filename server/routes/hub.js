import { Router } from 'express';
import { inventory } from '../models/Inventory';
import { users } from '../models/User';
import { verifyAuth, requireRole } from '../middleware/auth';
import { notify } from '../services/notificationService.js';
import { validate, hubVerifySchema } from '../schemas.js';

const router = Router();

/**
 * GET /api/hub/incoming — items at my hub not yet verified
 */
router.get('/incoming', verifyAuth, requireRole('hub'), (req, res) => {
  try {
    const incomingItems = inventory
      .filter((i) => i.status === 'at_hub' && (!i.hubId || i.hubId === req.user.id))
      .map((item) => {
        const collector = item.collectorId ? users.find((u) => u._id === item.collectorId) : null;
        const sourceUser = users.find((u) => u._id === item.sourceUserId);
        return {
          ...item,
          collectorName: collector?.name || 'Unknown',
          collectorPhone: collector?.phone || '',
          sourceUserName: sourceUser?.name || 'Unknown',
        };
      });
    res.json({ incomingItems, total: incomingItems.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/hub/verify — hub records actual qty + weight, produces QR sticker data
 */
router.post('/verify', verifyAuth, requireRole('hub'), validate(hubVerifySchema), (req, res) => {
  try {
    const { inventoryId, actualQty, weightKg, condition, category, photos } = req.body;
    const item = inventory.find((i) => i._id === inventoryId);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });

    const now = new Date().toISOString();
    // Preserve the originally-claimed qty & category for audit (once)
    if (item.claimedQty == null) item.claimedQty = item.actualQty;
    if (!item.claimedCategory) item.claimedCategory = item.category;

    item.actualQty = Number(actualQty);
    if (weightKg !== undefined && weightKg !== null && weightKg !== '') {
      item.weightKg = Number(weightKg);
    }
    item.condition = condition || item.condition;
    item.category = category || item.category;
    if (Array.isArray(photos)) item.verificationPhotos.push(...photos);
    item.hubId = req.user.id;
    item.hubVerifiedAt = now;
    item.status = 'verified';
    item.updatedAt = now;

    const me = users.find((u) => u._id === req.user.id);
    item.traceability.push({
      actor: req.user.id,
      actorName: me?.name,
      action: 'verified_at_hub',
      timestamp: now,
      photo: Array.isArray(photos) ? photos[0] : undefined,
    });

    // Notify all admins that verified items are ready to route
    const admins = users.filter((u) => u.role === 'admin');
    admins.forEach((a) =>
      notify(a._id, {
        type: 'hub_verified',
        title: 'New verified batch ready',
        message: `${me?.name || 'A hub'} verified ${item.actualQty} × ${item.category}. Awaiting your approval to assign to a recycler.`,
        relatedId: item._id,
      })
    );

    // QR sticker payload for printing
    const sticker = {
      qrCode: item.qrCode,
      inventoryId: item._id,
      category: item.category,
      actualQty: item.actualQty,
      unit: item.unit,
      weightKg: item.weightKg,
      hubName: me?.name || '',
      verifiedAt: item.hubVerifiedAt,
    };

    res.json({ message: 'Item verified', item, sticker });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/hub/inventory — my verified stock (and beyond) grouped by category
 */
router.get('/inventory', verifyAuth, requireRole('hub'), (req, res) => {
  try {
    const items = inventory
      .filter(
        (i) =>
          i.hubId === req.user.id &&
          ['verified', 'matched', 'in_transit', 'delivered', 'processed'].includes(i.status)
      )
      .map((item) => {
        const sourceUser = users.find((u) => u._id === item.sourceUserId);
        const recycler = item.recyclerId ? users.find((u) => u._id === item.recyclerId) : null;
        return {
          ...item,
          sourceUserName: sourceUser?.name || 'Unknown',
          recyclerName: recycler?.name || null,
        };
      });

    const grouped = {};
    items.forEach((item) => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    res.json({ verifiedItems: items, groupedByCategory: grouped, total: items.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/hub/flag — record discrepancy
 */
router.post('/flag', verifyAuth, requireRole('hub'), (req, res) => {
  try {
    const { inventoryId, reason, evidence } = req.body;
    if (!inventoryId || !reason) return res.status(400).json({ error: 'inventoryId and reason required' });

    const item = inventory.find((i) => i._id === inventoryId);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });

    const now = new Date().toISOString();
    item.traceability.push({
      actor: req.user.id,
      actorName: users.find((u) => u._id === req.user.id)?.name,
      action: 'flagged_discrepancy',
      note: reason,
      timestamp: now,
      photo: Array.isArray(evidence) ? evidence[0] : undefined,
    });
    item.updatedAt = now;

    res.json({ message: 'Discrepancy flagged', item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
