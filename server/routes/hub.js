import { Router } from 'express';
import { inventory } from '../models/Inventory';
import { intents } from '../models/Intent';
import { users } from '../models/User';
import { verifyAuth, requireRole } from '../middleware/auth';
import { generateId } from '../utils/helpers';

const router = Router();

/**
 * GET /api/hub/incoming
 * View incoming batches from collectors with enriched data
 */
router.get('/incoming', verifyAuth, requireRole('hub'), (req, res) => {
  try {
    const incomingItems = inventory
      .filter(i => i.status === 'at_hub' && (!i.hubId || i.hubId === req.user.id))
      .map(item => {
        const collector = item.collectorId ? users.find(u => u._id === item.collectorId) : null;
        const sourceUser = users.find(u => u._id === item.sourceUserId);
        return {
          ...item,
          collectorName: collector?.name || 'Unknown',
          collectorPhone: collector?.phone || '',
          sourceUserName: sourceUser?.name || 'Unknown',
        };
      });

    res.json({
      incomingItems,
      total: incomingItems.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/hub/verify
 * Verify and categorize items
 */
router.post('/verify', verifyAuth, requireRole('hub'), (req, res) => {
  try {
    const { inventoryId, actualQty, condition, category, photos } = req.body;

    if (!inventoryId || actualQty === undefined) {
      return res.status(400).json({ error: 'inventoryId and actualQty required' });
    }

    const item = inventory.find(i => i._id === inventoryId);
    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    item.actualQty = actualQty;
    item.condition = condition || item.condition;
    item.category = category || item.category;
    if (photos) item.verificationPhotos.push(...photos);
    item.hubId = req.user.id;
    item.hubVerifiedAt = new Date();
    item.status = 'verified';
    item.updatedAt = new Date();

    item.traceability.push({
      actor: req.user.id,
      action: 'verified_at_hub',
      timestamp: new Date(),
      qrScanned: false,
      photo: photos ? photos[0] : undefined,
    });

    res.json({
      message: 'Item verified successfully',
      item,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/hub/inventory
 * Current verified stock at this hub
 */
router.get('/inventory', verifyAuth, requireRole('hub'), (req, res) => {
  try {
    const verifiedItems = inventory
      .filter(i => i.hubId === req.user.id && ['verified', 'matched', 'in_transit', 'delivered', 'processed'].includes(i.status))
      .map(item => {
        const sourceUser = users.find(u => u._id === item.sourceUserId);
        return {
          ...item,
          sourceUserName: sourceUser?.name || 'Unknown',
        };
      });

    const grouped = {};
    verifiedItems.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    res.json({
      verifiedItems,
      groupedByCategory: grouped,
      total: verifiedItems.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/hub/flag
 * Flag discrepancies
 */
router.post('/flag', verifyAuth, requireRole('hub'), (req, res) => {
  try {
    const { inventoryId, reason, evidence } = req.body;

    if (!inventoryId || !reason) {
      return res.status(400).json({ error: 'inventoryId and reason required' });
    }

    const item = inventory.find(i => i._id === inventoryId);
    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    item.traceability.push({
      actor: req.user.id,
      action: 'flagged_discrepancy',
      timestamp: new Date(),
      qrScanned: false,
      photo: evidence ? evidence[0] : undefined,
    });

    item.updatedAt = new Date();

    res.json({
      message: 'Discrepancy flagged successfully',
      item,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
