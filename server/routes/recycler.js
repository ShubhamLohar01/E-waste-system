import { Router } from 'express';
import { inventory } from '../models/Inventory.js';
import { deliveries } from '../models/Delivery.js';
import { users } from '../models/User.js';
import { recyclerRequests } from '../models/RecyclerRequest.js';
import { verifyAuth, requireRole } from '../middleware/auth.js';
import { nextId, PREFIX } from '../utils/idGenerator.js';
import { maskCode } from '../utils/helpers.js';
import { notify } from '../services/notificationService.js';
import { validate, assignDeliverySchema, recyclerRequestSchema, acknowledgeBoxSchema, recyclerQualitySchema } from '../schemas.js';
import { boxes } from '../models/Box.js';
import { verifyBoxQr } from '../utils/boxCodes.js';

const router = Router();

/**
 * POST /api/recycler/requests — raise a material request to the admin.
 */
router.post('/requests', verifyAuth, requireRole('recycler'), validate(recyclerRequestSchema), (req, res) => {
  try {
    const { category, quantity, unit, note, targetDate } = req.body;
    const now = new Date().toISOString();
    const request = {
      _id: nextId(PREFIX.REQUEST),
      recyclerId: req.user.id,
      category,
      quantity,
      unit: unit || 'kg',
      note: note || null,
      targetDate: targetDate || null,
      status: 'pending',
      allocatedInventory: [],
      reviewedBy: null,
      reviewNote: null,
      createdAt: now,
      updatedAt: now,
    };
    recyclerRequests.push(request);

    const me = users.find((u) => u._id === req.user.id);
    users
      .filter((u) => u.role === 'admin')
      .forEach((a) =>
        notify(a._id, {
          type: 'recycler_request',
          title: 'New recycler material request',
          message: `${me?.name || 'A recycler'} requested ${quantity} ${unit || 'kg'} of ${category}. Review to assign stock.`,
          relatedId: request._id,
        })
      );

    res.status(201).json({ message: 'Request submitted to admin', request });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recycler/requests — my requests with status.
 */
router.get('/requests', verifyAuth, requireRole('recycler'), (req, res) => {
  try {
    const mine = recyclerRequests
      .filter((r) => r.recyclerId === req.user.id)
      .map((r) => ({
        ...r,
        allocatedCount: (r.allocatedInventory || []).length,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ requests: mine, total: mine.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/recycler/requests/:id/cancel — withdraw a still-pending request.
 */
router.post('/requests/:id/cancel', verifyAuth, requireRole('recycler'), (req, res) => {
  try {
    const request = recyclerRequests.find((r) => r._id === req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.recyclerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    if (request.status !== 'pending') {
      return res.status(409).json({ error: `Only pending requests can be cancelled (current: ${request.status}).` });
    }
    request.status = 'cancelled';
    request.updatedAt = new Date().toISOString();
    res.json({ message: 'Request cancelled', request });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recycler/orders — items admin has assigned to me
 */
router.get('/orders', verifyAuth, requireRole('recycler'), (req, res) => {
  try {
    const items = inventory
      .filter((i) => i.recyclerId === req.user.id)
      .map((item) => {
        const del = item.deliveryWorkerId ? users.find((u) => u._id === item.deliveryWorkerId) : null;
        // Hub identity is hidden from recyclers — they only see an opaque hub code.
        return {
          ...item,
          hubCode: maskCode(item.hubId, 'HUB'),
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
      .filter((i) => i && i.recyclerId === req.user.id && i.status === 'matched' && !i.deliveryWorkerId);

    if (items.length === 0) {
      return res.status(400).json({ error: 'No eligible items (must be assigned to you, status=matched, not yet dispatched)' });
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
      _id: nextId(PREFIX.DELIVERY),
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
      // Assigning a delivery worker moves the item out of the recycler's
      // selectable "awaiting pickup" list into the read-only "Dispatched"
      // section (discriminated client-side by deliveryWorkerId). Status stays
      // 'matched' until the worker's pickup sets it to 'in_transit'.
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
        // Hub identity hidden — recycler sees only an opaque hub code.
        return {
          ...d,
          deliveryWorkerName: worker?.name,
          deliveryWorkerPhone: worker?.phone,
          hubCode: maskCode(d.pickupHub, 'HUB'),
        };
      });
    res.json({ deliveries: mine, total: mine.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recycler/boxes — boxes for my delivered items, grouped by item.
 */
router.get('/boxes', verifyAuth, requireRole('recycler'), (req, res) => {
  try {
    const myItems = new Map(
      inventory.filter((i) => i.recyclerId === req.user.id).map((i) => [i._id, i]),
    );
    const visible = boxes.filter((b) => {
      const it = myItems.get(b.inventoryId);
      if (!it) return false;
      // Only physically printed boxes are relevant (ignore unprinted previews);
      // they become visible once the item has been delivered to this recycler.
      if (!['printed', 'acknowledged'].includes(b.status)) return false;
      return ['delivered', 'processed'].includes(it.status);
    });

    const groups = {};
    for (const b of visible) {
      if (!groups[b.inventoryId]) {
        const it = myItems.get(b.inventoryId);
        groups[b.inventoryId] = {
          inventoryId: b.inventoryId,
          itemName: b.itemName || it?.category,
          transactionNo: b.transactionNo,
          total: 0,
          acknowledged: 0,
          // Quality assessment recorded once all boxes for this item are in.
          qualityRating: it?.qualityRating ?? null,
          technicianName: it?.technicianName ?? null,
          boxes: [],
        };
      }
      const g = groups[b.inventoryId];
      g.total += 1;
      if (b.status === 'acknowledged') g.acknowledged += 1;
      g.boxes.push({
        boxId: b._id,
        qrPayload: b.qrPayload,
        netWeightKg: b.netWeightKg,
        boxSeq: b.boxSeq,
        boxCount: b.boxCount,
        status: b.status,
      });
    }
    const items = Object.values(groups).map((g) => ({
      ...g,
      boxes: g.boxes.sort((a, b) => a.boxSeq - b.boxSeq),
    }));
    res.json({ items, total: items.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/recycler/acknowledge — recycler scanned a box QR on receipt.
 * Records the recycler company on the box; marks the item received once all boxes are in.
 */
router.post('/acknowledge', verifyAuth, requireRole('recycler'), validate(acknowledgeBoxSchema), (req, res) => {
  try {
    const { scannedQr } = req.body;
    const decoded = verifyBoxQr(scannedQr);
    if (!decoded) return res.status(400).json({ error: 'Invalid or unrecognised QR code.' });

    const box = boxes.find((b) => b._id === decoded.boxId);
    if (!box) return res.status(404).json({ error: 'Box not found.' });

    const item = inventory.find((i) => i._id === box.inventoryId);
    if (!item || item.recyclerId !== req.user.id) {
      return res.status(403).json({ error: 'This box is not assigned to you.' });
    }
    if (!['delivered', 'processed'].includes(item.status)) {
      return res.status(409).json({ error: 'Item has not been delivered yet.' });
    }

    const me = users.find((u) => u._id === req.user.id);
    const now = new Date().toISOString();
    const alreadyAcked = box.status === 'acknowledged';
    if (!alreadyAcked) {
      box.status = 'acknowledged';
      box.recyclerId = req.user.id;
      box.recyclerCompany = me?.name || '';
      box.acknowledgedAt = now;
      box.updatedAt = now;
    }

    // Count only printed/acknowledged boxes — unprinted previews never gate completion.
    const itemBoxes = boxes.filter(
      (b) => b.inventoryId === item._id && ['printed', 'acknowledged'].includes(b.status),
    );
    const acknowledged = itemBoxes.filter((b) => b.status === 'acknowledged').length;
    const complete = itemBoxes.length > 0 && acknowledged === itemBoxes.length;
    if (complete && !item.traceability.some((t) => t.action === 'received_at_recycler')) {
      item.traceability.push({
        actor: req.user.id,
        actorName: me?.name,
        action: 'received_at_recycler',
        timestamp: now,
      });
      item.updatedAt = now;
    }

    res.json({
      message: alreadyAcked ? 'Box already acknowledged' : 'Box acknowledged',
      boxId: box._id,
      acknowledged,
      total: itemBoxes.length,
      complete,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/recycler/quality — record a technician's name and 1–10 quality
 * rating for a received item. Allowed once the item has reached the recycler
 * (status delivered/processed).
 */
router.post('/quality', verifyAuth, requireRole('recycler'), validate(recyclerQualitySchema), (req, res) => {
  try {
    const { inventoryId, technicianName, qualityRating } = req.body;
    const item = inventory.find((i) => i._id === inventoryId);
    if (!item || item.recyclerId !== req.user.id) {
      return res.status(404).json({ error: 'Item not found or not assigned to you.' });
    }
    if (!['delivered', 'processed'].includes(item.status)) {
      return res.status(409).json({ error: 'Item has not been received yet.' });
    }

    const me = users.find((u) => u._id === req.user.id);
    const now = new Date().toISOString();
    item.qualityRating = qualityRating;
    item.technicianName = technicianName;
    item.traceability.push({
      actor: req.user.id,
      actorName: me?.name,
      action: 'quality_assessed',
      note: `Quality ${qualityRating}/10 by ${technicianName}`,
      timestamp: now,
    });
    item.updatedAt = now;

    res.json({ message: 'Quality recorded', inventoryId, qualityRating, technicianName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
