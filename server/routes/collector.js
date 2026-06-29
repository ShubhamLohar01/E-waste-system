import { Router } from 'express';
import { inventory } from '../models/Inventory.js';
import { intents } from '../models/Intent.js';
import { users } from '../models/User.js';
import { verifyAuth, requireRole } from '../middleware/auth.js';
import { generateQRCode, generateCollectionId, validateImageDataUrl } from '../utils/helpers.js';
import { haversineKm } from '../utils/distance.js';
import { notify } from '../services/notificationService.js';

const router = Router();

// Pickup requests beyond this radius from the collector's set location are hidden.
const MAX_PICKUP_RADIUS_KM = 15;

/**
 * GET /api/collector/pending — unassigned requests sorted by distance from me.
 * Once the collector has a location set, requests farther than
 * MAX_PICKUP_RADIUS_KM are excluded; requests with unknown distance
 * (no location yet, or no intent coordinates) are still shown.
 */
router.get('/pending', verifyAuth, requireRole('local_collector'), (req, res) => {
  try {
    const me = users.find((u) => u._id === req.user.id);
    const myLoc = me?.location;

    const pending = intents
      .filter((i) => i.status === 'submitted' && !i.assignedCollector)
      .map((intent) => {
        const sourceUser = users.find((u) => u._id === intent.userId);
        const distanceKm = haversineKm(myLoc, intent.location);
        return {
          ...intent,
          userName: sourceUser?.name || 'Unknown',
          userPhone: sourceUser?.phone || '',
          userAddress: intent.location?.address || '',
          distanceKm: Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(2)) : null,
        };
      })
      .filter((i) => i.distanceKm == null || i.distanceKm <= MAX_PICKUP_RADIUS_KM)
      .sort((a, b) => (a.distanceKm ?? 9e9) - (b.distanceKm ?? 9e9));

    res.json({ intents: pending, total: pending.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/collector/accept — lock request to me + notify small user
 */
router.post('/accept', verifyAuth, requireRole('local_collector'), (req, res) => {
  try {
    const { intentId } = req.body;
    if (!intentId) return res.status(400).json({ error: 'intentId required' });

    const intent = intents.find((i) => i._id === intentId);
    if (!intent) return res.status(404).json({ error: 'Request not found' });
    if (intent.status !== 'submitted' || intent.assignedCollector) {
      return res.status(409).json({ error: 'Request already accepted by another collector' });
    }

    intent.assignedCollector = req.user.id;
    intent.status = 'assigned';
    intent.updatedAt = new Date().toISOString();

    const me = users.find((u) => u._id === req.user.id);
    notify(intent.userId, {
      type: 'pickup_accepted',
      title: 'Your pickup has been accepted',
      message: `${me?.name || 'A collector'} has accepted your pickup request and will collect your e-waste shortly. Phone: ${me?.phone || '—'}`,
      relatedId: intent._id,
    });

    res.json({ message: 'Request accepted', intent, collectorName: me?.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/collector/assignments
 */
router.get('/assignments', verifyAuth, requireRole('local_collector'), (req, res) => {
  try {
    const assigned = intents
      .filter((i) => i.assignedCollector === req.user.id && i.status !== 'cancelled')
      .map((intent) => {
        const sourceUser = users.find((u) => u._id === intent.userId);
        const items = inventory.filter((i) => i.intentId === intent._id);
        return {
          ...intent,
          userName: sourceUser?.name || 'Unknown',
          userPhone: sourceUser?.phone || '',
          userAddress: intent.location?.address || '',
          inventoryItems: items,
        };
      });
    res.json({ assignments: assigned, total: assigned.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/collector/collect — mark picked up from source user
 */
router.post('/collect', verifyAuth, requireRole('local_collector'), (req, res) => {
  try {
    const { intentId, items, photo } = req.body;
    if (!intentId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'intentId and items array required' });
    }
    const check = validateImageDataUrl(photo, 5 * 1024 * 1024);
    if (!check.ok) return res.status(400).json({ error: check.error });

    const intent = intents.find((i) => i._id === intentId);
    if (!intent) return res.status(404).json({ error: 'Intent not found' });

    const now = new Date().toISOString();
    intent.status = 'collected';
    intent.updatedAt = now;

    const existingCollectionIds = inventory.filter((i) => i.collectionId).map((i) => i.collectionId);
    const updatedItems = [];
    for (const item of items) {
      const invItem = inventory.find((i) => i.intentId === intentId && i.category === item.category);
      if (invItem) {
        invItem.collectionId = generateCollectionId(existingCollectionIds);
        existingCollectionIds.push(invItem.collectionId);
        invItem.status = 'collected';
        invItem.qrCode = generateQRCode(invItem._id);
        invItem.collectorId = req.user.id;
        invItem.verificationPhotos.push(photo);
        invItem.traceability.push({
          actor: req.user.id,
          actorName: users.find((u) => u._id === req.user.id)?.name,
          action: 'collected',
          timestamp: now,
          photo,
        });
        invItem.updatedAt = now;
        updatedItems.push(invItem);
      }
    }

    notify(intent.userId, {
      type: 'picked_up',
      title: 'Your e-waste has been picked up',
      message: `Your items were collected. They are now heading to the hub for verification.`,
      relatedId: intent._id,
    });

    res.json({
      message: 'Collection logged',
      intent,
      itemsCollected: updatedItems.length,
      updatedItems,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/collector/hub-delivery — hand over to a hub
 */
router.post('/hub-delivery', verifyAuth, requireRole('local_collector'), (req, res) => {
  try {
    const { hubId, itemIds } = req.body;
    if (!hubId || !itemIds || !Array.isArray(itemIds)) {
      return res.status(400).json({ error: 'hubId and itemIds array required' });
    }

    const hub = users.find((u) => u._id === hubId && u.role === 'hub');
    if (!hub) return res.status(404).json({ error: 'Hub not found' });

    const now = new Date().toISOString();
    const me = users.find((u) => u._id === req.user.id);
    for (const itemId of itemIds) {
      const invItem = inventory.find((i) => i._id === itemId);
      if (invItem) {
        invItem.status = 'at_hub';
        invItem.hubId = hubId;
        invItem.traceability.push({
          actor: req.user.id,
          actorName: me?.name,
          action: 'delivered_to_hub',
          timestamp: now,
        });
        invItem.updatedAt = now;
      }
    }

    notify(hubId, {
      type: 'incoming_shipment',
      title: 'Incoming items from a collector',
      message: `${me?.name || 'A collector'} has delivered ${itemIds.length} item(s). Please receive and verify.`,
    });

    res.json({ message: 'Hub delivery recorded', hubName: hub.name, itemsDelivered: itemIds.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/collector/hubs — nearest hubs first
 */
router.get('/hubs', verifyAuth, requireRole('local_collector'), (req, res) => {
  try {
    const me = users.find((u) => u._id === req.user.id);
    const hubs = users
      .filter((u) => u.role === 'hub' && u.isActive)
      .map((u) => {
        const distanceKm = haversineKm(me?.location, u.location);
        return {
          _id: u._id,
          name: u.name,
          address: u.location?.address || '',
          lat: u.location?.lat ?? null,
          lng: u.location?.lng ?? null,
          phone: u.phone,
          email: u.email,
          distanceKm: Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(2)) : null,
        };
      })
      .sort((a, b) => (a.distanceKm ?? 9e9) - (b.distanceKm ?? 9e9));
    res.json({ hubs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/collector/history
 */
router.get('/history', verifyAuth, requireRole('local_collector'), (req, res) => {
  try {
    const collectedItems = inventory.filter((i) => i.collectorId === req.user.id);
    res.json({
      items: collectedItems,
      totalCollected: collectedItems.length,
      deliveredToHub: collectedItems.filter((i) =>
        ['at_hub', 'received', 'pending_print', 'verified', 'matched', 'in_transit', 'delivered', 'processed'].includes(i.status)
      ).length,
      processed: collectedItems.filter((i) => i.status === 'processed').length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
