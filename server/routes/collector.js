import { Router } from 'express';
import { inventory } from '../models/Inventory';
import { intents } from '../models/Intent';
import { users } from '../models/User';
import { verifyAuth, requireRole } from '../middleware/auth';
import { generateQRCode, generateCollectionId } from '../utils/helpers';

const router = Router();

/**
 * GET /api/collector/pending
 * All submitted (unassigned) intents that collectors can self-accept
 */
router.get('/pending', verifyAuth, requireRole('local_collector'), (req, res) => {
  try {
    const pendingIntents = intents
      .filter(i => i.status === 'submitted' && !i.assignedCollector)
      .map(intent => {
        const sourceUser = users.find(u => u._id === intent.userId);
        return {
          ...intent,
          userName: sourceUser?.name || 'Unknown',
          userPhone: sourceUser?.phone || '',
          userAddress: intent.location?.address || '',
        };
      });

    res.json({ intents: pendingIntents, total: pendingIntents.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/collector/accept
 * Collector self-assigns to a submitted intent
 */
router.post('/accept', verifyAuth, requireRole('local_collector'), (req, res) => {
  try {
    const { intentId } = req.body;
    if (!intentId) {
      return res.status(400).json({ error: 'intentId required' });
    }

    const intent = intents.find(i => i._id === intentId);
    if (!intent) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (intent.status !== 'submitted' || intent.assignedCollector) {
      return res.status(409).json({ error: 'Request already accepted by another collector' });
    }

    intent.assignedCollector = req.user.id;
    intent.status = 'assigned';
    intent.updatedAt = new Date();

    res.json({
      message: 'Request accepted successfully',
      intent,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/collector/assignments
 * View assigned pickups with enriched user data
 */
router.get('/assignments', verifyAuth, requireRole('local_collector'), (req, res) => {
  try {
    const assignedIntents = intents
      .filter(i => i.assignedCollector === req.user.id && i.status !== 'cancelled')
      .map(intent => {
        const sourceUser = users.find(u => u._id === intent.userId);
        const items = inventory.filter(i => i.intentId === intent._id);
        return {
          ...intent,
          userName: sourceUser?.name || 'Unknown',
          userPhone: sourceUser?.phone || '',
          userAddress: intent.location?.address || '',
          inventoryItems: items,
        };
      });

    res.json({
      assignments: assignedIntents,
      total: assignedIntents.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/collector/collect
 * Log collection with proof
 */
router.post('/collect', verifyAuth, requireRole('local_collector'), (req, res) => {
  try {
    const { intentId, items, photo } = req.body;

    if (!intentId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'intentId and items array required' });
    }
    if (!photo || typeof photo !== 'string') {
      return res.status(400).json({ error: 'Photo of the collected item(s) is required. Please take or upload a photo before marking as collected.' });
    }

    const intent = intents.find(i => i._id === intentId);
    if (!intent) {
      return res.status(404).json({ error: 'Intent not found' });
    }

    intent.status = 'collected';
    intent.updatedAt = new Date();

    const existingCollectionIds = inventory
      .filter((i) => i.collectionId)
      .map((i) => i.collectionId);
    const updatedItems = [];
    items.forEach((item) => {
      const invItem = inventory.find(i => i.intentId === intentId && i.category === item.category);
      if (invItem) {
        invItem.collectionId = generateCollectionId(existingCollectionIds);
        existingCollectionIds.push(invItem.collectionId);
        invItem.status = 'collected';
        invItem.qrCode = generateQRCode();
        invItem.collectorId = req.user.id;
        invItem.verificationPhotos.push(photo);
        invItem.traceability.push({
          actor: req.user.id,
          action: 'collected',
          timestamp: new Date(),
          qrScanned: false,
          photo,
        });
        invItem.updatedAt = new Date();
        updatedItems.push(invItem);
      }
    });

    res.json({
      message: 'Collection logged successfully',
      intent,
      itemsCollected: updatedItems.length,
      updatedItems,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/collector/hub-delivery
 * Record delivery to hub
 */
router.post('/hub-delivery', verifyAuth, requireRole('local_collector'), (req, res) => {
  try {
    const { intentId, hubId, itemIds } = req.body;

    if (!hubId || !itemIds || !Array.isArray(itemIds)) {
      return res.status(400).json({ error: 'hubId and itemIds array required' });
    }

    const hub = users.find(u => u._id === hubId && u.role === 'hub');
    if (!hub) {
      return res.status(404).json({ error: 'Hub not found' });
    }

    itemIds.forEach((itemId) => {
      const invItem = inventory.find(i => i._id === itemId);
      if (invItem) {
        invItem.status = 'at_hub';
        invItem.hubId = hubId;
        invItem.traceability.push({
          actor: req.user.id,
          action: 'delivered_to_hub',
          timestamp: new Date(),
          qrScanned: false,
        });
        invItem.updatedAt = new Date();
      }
    });

    res.json({
      message: 'Hub delivery recorded successfully',
      hubName: hub.name,
      itemsDelivered: itemIds.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/collector/hubs
 * Get list of available hubs
 */
router.get('/hubs', verifyAuth, requireRole('local_collector'), (req, res) => {
  try {
    const hubs = users
      .filter(u => u.role === 'hub' && u.isActive)
      .map(u => ({
        _id: u._id,
        name: u.name,
        address: u.location?.address || '',
        phone: u.phone,
      }));

    res.json({ hubs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/collector/routes
 * View collection routes
 */
router.get('/routes', verifyAuth, requireRole('local_collector'), (req, res) => {
  try {
    const myIntents = intents.filter(i => i.assignedCollector === req.user.id);

    res.json({
      routes: myIntents,
      total: myIntents.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/collector/history
 * Collection history - completed work
 */
router.get('/history', verifyAuth, requireRole('local_collector'), (req, res) => {
  try {
    const collectedItems = inventory.filter(i => i.collectorId === req.user.id);

    res.json({
      items: collectedItems,
      totalCollected: collectedItems.length,
      deliveredToHub: collectedItems.filter(i => ['at_hub', 'verified', 'matched', 'in_transit', 'delivered', 'processed'].includes(i.status)).length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
