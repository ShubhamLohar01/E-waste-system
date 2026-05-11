import { Router } from 'express';
import { inventory } from '../models/Inventory';
import { deliveries } from '../models/Delivery';
import { users } from '../models/User';
import { verifyAuth, requireRole } from '../middleware/auth';
import { generateId } from '../utils/helpers';
import { notify } from '../services/notificationService.js';
import { validate, assignDeliverySchema } from '../schemas.js';

const router = Router();

/**
 * GET /api/recycler/orders — items admin has assigned to me
 */
router.get('/orders', verifyAuth, requireRole('recycler'), (req, res) => {
  try {
    const items = inventory
      .filter((i) => i.recyclerId === req.user.id)
      .map((item) => {
        const hub = item.hubId ? users.find((u) => u._id === item.hubId) : null;
        const del = item.deliveryWorkerId ? users.find((u) => u._id === item.deliveryWorkerId) : null;
        return {
          ...item,
          hubName: hub?.name,
          hubAddress: hub?.location?.address,
          deliveryWorkerName: del?.name,
        };
      });

    res.json({ items, total: items.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recycler/delivery-agents — list of available delivery workers
 */
router.get('/delivery-agents', verifyAuth, requireRole('recycler'), (req, res) => {
  try {
    const agents = users
      .filter((u) => u.role === 'delivery_worker' && u.isActive)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        phone: u.phone,
        location: u.location?.address,
        reliabilityScore: u.reliabilityScore || 90,
      }));
    res.json({ agents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/recycler/assign-delivery
 * body: { inventoryIds: [], deliveryWorkerId }
 * Creates ONE Delivery record with all items as a single manifest, notifies the delivery boy.
 */
router.post('/assign-delivery', verifyAuth, requireRole('recycler'), validate(assignDeliverySchema), (req, res) => {
  try {
    const { inventoryIds, deliveryWorkerId } = req.body;
    const worker = users.find((u) => u._id === deliveryWorkerId && u.role === 'delivery_worker');
    if (!worker) return res.status(404).json({ error: 'Delivery agent not found' });

    const items = inventoryIds
      .map((id) => inventory.find((i) => i._id === id))
      .filter((i) => i && i.recyclerId === req.user.id && i.status === 'matched');

    if (items.length === 0) {
      return res.status(400).json({ error: 'No eligible items (must be assigned to you and status=matched)' });
    }

    const pickupHubId = items[0].hubId;
    const mismatch = items.find((it) => it.hubId !== pickupHubId);
    if (mismatch) {
      return res
        .status(400)
        .json({ error: 'All selected items must currently sit at the same hub to create one delivery task.' });
    }

    const now = new Date().toISOString();
    const delivery = {
      _id: generateId(),
      deliveryWorkerId,
      pickupHub: pickupHubId,
      dropoffRecycler: req.user.id,
      manifest: items.map((it) => ({
        inventoryId: it._id,
        qrCode: it.qrCode,
        category: it.category,
        qty: it.actualQty,
        unit: it.unit,
        weightKg: it.weightKg,
      })),
      status: 'assigned',
      pickupProof: { qrScanned: false },
      dropoffProof: { qrScanned: false },
      createdAt: now,
      updatedAt: now,
    };
    deliveries.push(delivery);

    const me = users.find((u) => u._id === req.user.id);
    items.forEach((item) => {
      item.deliveryWorkerId = deliveryWorkerId;
      item.traceability.push({
        actor: req.user.id,
        actorName: me?.name,
        action: 'delivery_assigned',
        note: `${worker.name} assigned by recycler`,
        timestamp: now,
      });
      item.updatedAt = now;
    });

    notify(deliveryWorkerId, {
      type: 'delivery_assigned',
      title: 'New delivery task',
      message: `${me?.name || 'Recycler'} assigned you ${items.length} item(s) to pick up from a hub.`,
      relatedId: delivery._id,
    });

    res.status(201).json({ message: 'Delivery assigned', delivery });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recycler/deliveries — my inbound deliveries
 */
router.get('/deliveries', verifyAuth, requireRole('recycler'), (req, res) => {
  try {
    const mine = deliveries
      .filter((d) => d.dropoffRecycler === req.user.id)
      .map((d) => {
        const worker = users.find((u) => u._id === d.deliveryWorkerId);
        const hub = users.find((u) => u._id === d.pickupHub);
        return {
          ...d,
          deliveryWorkerName: worker?.name,
          deliveryWorkerPhone: worker?.phone,
          hubName: hub?.name,
        };
      });
    res.json({ deliveries: mine, total: mine.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
