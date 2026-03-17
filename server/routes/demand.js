import { Router } from 'express';
import { demands } from '../models/Demand';
import { inventory } from '../models/Inventory';
import { deliveries } from '../models/Delivery';
import { verifyAuth, requireRole } from '../middleware/auth';
import { generateId } from '../utils/helpers';

const router = Router();

/**
 * POST /api/demand
 * Submit demand request
 */
router.post('/', verifyAuth, requireRole('recycler'), (req, res) => {
  try {
    const { category, quantityNeeded, unit, deliveryWindow } = req.body;

    if (!category || !quantityNeeded || !unit) {
      return res.status(400).json({ error: 'category, quantityNeeded, and unit required' });
    }

    const demand = {
      _id: generateId(),
      recyclerId: req.user.id,
      category,
      quantityNeeded,
      unit,
      deliveryWindow: deliveryWindow || {
        start: new Date(),
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      status: 'open',
      matchedInventory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    demands.push(demand);

    res.status(201).json({
      message: 'Demand created successfully',
      demand,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/demand
 * Get all demands for current recycler
 */
router.get('/', verifyAuth, requireRole('recycler'), (req, res) => {
  try {
    const myDemands = demands.filter(d => d.recyclerId === req.user.id);

    res.json({
      demands: myDemands,
      total: myDemands.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/demand/:id
 * Get specific demand
 */
router.get('/:id', verifyAuth, requireRole('recycler'), (req, res) => {
  try {
    const demand = demands.find(d => d._id === req.params.id);
    if (!demand) {
      return res.status(404).json({ error: 'Demand not found' });
    }

    if (demand.recyclerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const matchedItems = inventory.filter(i => demand.matchedInventory.includes(i._id));

    res.json({
      demand,
      matchedItems,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/demand/:id/confirm
 * Confirm receipt of delivery
 */
router.post('/:id/confirm', verifyAuth, requireRole('recycler'), (req, res) => {
  try {
    const { deliveryId, photo } = req.body;

    const demand = demands.find(d => d._id === req.params.id);
    if (!demand) {
      return res.status(404).json({ error: 'Demand not found' });
    }

    if (demand.recyclerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const delivery = deliveries.find(d => d._id === deliveryId);
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    // Update delivery
    delivery.status = 'delivered';
    delivery.dropoffProof = {
      qrScanned: true,
      photo: photo,
      timestamp: new Date(),
    };
    delivery.updatedAt = new Date();

    // Update inventory items to delivered
    delivery.manifest.forEach(item => {
      const invItem = inventory.find(i => i._id === item.inventoryId);
      if (invItem) {
        invItem.status = 'delivered';
        invItem.recyclerId = req.user.id;
        invItem.traceability.push({
          actor: req.user.id,
          action: 'received_at_recycler',
          timestamp: new Date(),
          qrScanned: true,
          photo,
        });
        invItem.updatedAt = new Date();
      }
    });

    // Check if demand is fully matched
    const allMatched = delivery.manifest.every(item =>
      inventory.find(i => i._id === item.inventoryId && i.status === 'delivered')
    );

    if (allMatched) {
      demand.status = 'fulfilled';
      demand.updatedAt = new Date();
    }

    res.json({
      message: 'Delivery confirmed successfully',
      delivery,
      demand,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/demand/:id/deliveries
 * Track scheduled deliveries
 */
router.get('/:id/deliveries', verifyAuth, requireRole('recycler'), (req, res) => {
  try {
    const demand = demands.find(d => d._id === req.params.id);
    if (!demand || demand.recyclerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const relatedDeliveries = deliveries.filter(d => d.demandId === req.params.id);

    res.json({
      deliveries: relatedDeliveries,
      total: relatedDeliveries.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
