import { Router, Response } from 'express';
import { Delivery, deliveries } from '../models/Delivery';
import { inventory } from '../models/Inventory';
import { verifyAuth, requireRole, AuthRequest } from '../middleware/auth';
import { generateId } from '../utils/helpers';

const router = Router();

/**
 * GET /api/delivery/tasks
 * View delivery assignments
 */
router.get('/tasks', verifyAuth, requireRole('delivery_worker'), (req: AuthRequest, res: Response) => {
  try {
    const myTasks = deliveries.filter(d => d.deliveryWorkerId === req.user!.id);

    res.json({
      tasks: myTasks,
      total: myTasks.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/delivery/:id/pickup
 * Confirm hub pickup via QR scan
 */
router.post('/:id/pickup', verifyAuth, requireRole('delivery_worker'), (req: AuthRequest, res: Response) => {
  try {
    const delivery = deliveries.find(d => d._id === req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const { photo } = req.body;

    delivery.status = 'picked_up';
    delivery.pickupProof = {
      qrScanned: true,
      photo,
      timestamp: new Date(),
    };
    delivery.updatedAt = new Date();

    // Update inventory items to in_transit
    delivery.manifest.forEach(item => {
      const invItem = inventory.find(i => i._id === item.inventoryId);
      if (invItem) {
        invItem.status = 'in_transit';
        invItem.deliveryWorkerId = req.user!.id;
        invItem.traceability.push({
          actor: req.user!.id,
          action: 'picked_up_from_hub',
          timestamp: new Date(),
          qrScanned: true,
          photo,
        });
        invItem.updatedAt = new Date();
      }
    });

    res.json({
      message: 'Pickup confirmed',
      delivery,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/delivery/:id/dropoff
 * Confirm recycler delivery via QR scan
 */
router.post('/:id/dropoff', verifyAuth, requireRole('delivery_worker'), (req: AuthRequest, res: Response) => {
  try {
    const delivery = deliveries.find(d => d._id === req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const { photo } = req.body;

    delivery.status = 'delivered';
    delivery.dropoffProof = {
      qrScanned: true,
      photo,
      timestamp: new Date(),
    };
    delivery.updatedAt = new Date();

    res.json({
      message: 'Dropoff confirmed',
      delivery,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/delivery/earnings
 * View earnings and performance score
 */
router.get('/earnings', verifyAuth, requireRole('delivery_worker'), (req: AuthRequest, res: Response) => {
  try {
    const myDeliveries = deliveries.filter(d => d.deliveryWorkerId === req.user!.id);
    const completedDeliveries = myDeliveries.filter(d => d.status === 'delivered');
    const reliabilityScore = (completedDeliveries.length / Math.max(myDeliveries.length, 1)) * 100;

    res.json({
      totalDeliveries: myDeliveries.length,
      completedDeliveries: completedDeliveries.length,
      reliabilityScore: Math.round(reliabilityScore),
      earnings: completedDeliveries.length * 100, // $100 per delivery
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
