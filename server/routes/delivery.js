import { Router } from 'express';
import { deliveries } from '../models/Delivery';
import { inventory } from '../models/Inventory';
import { users } from '../models/User';
import { verifyAuth, requireRole } from '../middleware/auth';
import { notify } from '../services/notificationService.js';
import { verifyQRCode, validateImageDataUrl } from '../utils/helpers';

const router = Router();

/**
 * GET /api/delivery/tasks — delivery boy's pickup list
 */
router.get('/tasks', verifyAuth, requireRole('delivery_worker'), (req, res) => {
  try {
    const myTasks = deliveries
      .filter((d) => d.deliveryWorkerId === req.user.id)
      .map((d) => {
        const hub = users.find((u) => u._id === d.pickupHub);
        const recycler = users.find((u) => u._id === d.dropoffRecycler);
        const items = d.manifest
          .map((m) => inventory.find((i) => i._id === m.inventoryId))
          .filter(Boolean);
        return {
          ...d,
          hubName: hub?.name,
          hubAddress: hub?.location?.address,
          hubPhone: hub?.phone,
          recyclerName: recycler?.name,
          recyclerAddress: recycler?.location?.address,
          recyclerPhone: recycler?.phone,
          items,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ tasks: myTasks, total: myTasks.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/delivery/:id/pickup
 */
router.post('/:id/pickup', verifyAuth, requireRole('delivery_worker'), (req, res) => {
  try {
    const delivery = deliveries.find((d) => d._id === req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    if (delivery.deliveryWorkerId !== req.user.id) {
      return res.status(403).json({ error: 'Not your delivery' });
    }

    const { photo, scannedQrCodes } = req.body;
    const pCheck = validateImageDataUrl(photo, 5 * 1024 * 1024);
    if (!pCheck.ok) return res.status(400).json({ error: pCheck.error });

    // If the client sends scanned QR strings, verify each against the manifest.
    // (If none sent — keep backward compatibility; but the client dashboards ship them.)
    if (Array.isArray(scannedQrCodes) && scannedQrCodes.length) {
      const manifestQrs = new Set(delivery.manifest.map((m) => m.qrCode));
      for (const qr of scannedQrCodes) {
        const verified = verifyQRCode(qr);
        if (!verified) return res.status(400).json({ error: `QR signature invalid: ${qr}` });
        if (!manifestQrs.has(qr)) {
          return res.status(400).json({ error: `Scanned QR ${qr.slice(0, 20)}… is not in this delivery manifest` });
        }
      }
    }

    const now = new Date().toISOString();
    delivery.status = 'picked_up';
    delivery.pickupProof = {
      qrScanned: Array.isArray(scannedQrCodes) && scannedQrCodes.length > 0,
      scannedCount: scannedQrCodes?.length || 0,
      photo,
      timestamp: now,
    };
    delivery.updatedAt = now;

    const me = users.find((u) => u._id === req.user.id);
    delivery.manifest.forEach((m) => {
      const item = inventory.find((i) => i._id === m.inventoryId);
      if (item) {
        item.status = 'in_transit';
        item.deliveryWorkerId = req.user.id;
        item.traceability.push({
          actor: req.user.id,
          actorName: me?.name,
          action: 'picked_up_from_hub',
          timestamp: now,
          photo,
        });
        item.updatedAt = now;
      }
    });

    notify(delivery.dropoffRecycler, {
      type: 'shipment_dispatched',
      title: 'Shipment on the way',
      message: `${me?.name || 'Delivery agent'} picked up ${delivery.manifest.length} item(s) and is heading to you.`,
      relatedId: delivery._id,
    });

    res.json({ message: 'Pickup confirmed', delivery });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/delivery/:id/dropoff
 */
router.post('/:id/dropoff', verifyAuth, requireRole('delivery_worker'), (req, res) => {
  try {
    const delivery = deliveries.find((d) => d._id === req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    if (delivery.deliveryWorkerId !== req.user.id) {
      return res.status(403).json({ error: 'Not your delivery' });
    }

    const { photo, scannedQrCodes } = req.body;
    const pCheck = validateImageDataUrl(photo, 5 * 1024 * 1024);
    if (!pCheck.ok) return res.status(400).json({ error: pCheck.error });

    if (Array.isArray(scannedQrCodes) && scannedQrCodes.length) {
      const manifestQrs = new Set(delivery.manifest.map((m) => m.qrCode));
      for (const qr of scannedQrCodes) {
        const verified = verifyQRCode(qr);
        if (!verified) return res.status(400).json({ error: `QR signature invalid: ${qr}` });
        if (!manifestQrs.has(qr)) {
          return res.status(400).json({ error: `Scanned QR ${qr.slice(0, 20)}… is not in this delivery manifest` });
        }
      }
    }

    const now = new Date().toISOString();
    delivery.status = 'delivered';
    delivery.dropoffProof = {
      qrScanned: Array.isArray(scannedQrCodes) && scannedQrCodes.length > 0,
      scannedCount: scannedQrCodes?.length || 0,
      photo,
      timestamp: now,
    };
    delivery.updatedAt = now;

    const me = users.find((u) => u._id === req.user.id);
    delivery.manifest.forEach((m) => {
      const item = inventory.find((i) => i._id === m.inventoryId);
      if (item) {
        item.status = 'delivered';
        item.traceability.push({
          actor: req.user.id,
          actorName: me?.name,
          action: 'delivered_to_recycler',
          timestamp: now,
          photo,
        });
        item.updatedAt = now;
      }
    });

    const admins = users.filter((u) => u.role === 'admin');
    admins.forEach((a) =>
      notify(a._id, {
        type: 'delivery_complete',
        title: 'Delivery complete — awaiting payment',
        message: `${delivery.manifest.length} item(s) delivered to recycler. Please confirm payment to finalise.`,
        relatedId: delivery._id,
      })
    );

    res.json({ message: 'Dropoff confirmed', delivery });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/delivery/earnings
 */
router.get('/earnings', verifyAuth, requireRole('delivery_worker'), (req, res) => {
  try {
    const mine = deliveries.filter((d) => d.deliveryWorkerId === req.user.id);
    const completed = mine.filter((d) => d.status === 'delivered');
    const reliabilityScore = mine.length ? Math.round((completed.length / mine.length) * 100) : 100;
    res.json({
      totalDeliveries: mine.length,
      completedDeliveries: completed.length,
      reliabilityScore,
      earningsINR: completed.length * 250,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
