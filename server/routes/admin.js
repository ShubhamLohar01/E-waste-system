import { Router } from 'express';
import { users } from '../models/User';
import { inventory } from '../models/Inventory';
import { intents } from '../models/Intent';
import { demands } from '../models/Demand';
import { disputes } from '../models/Dispute';
import { deliveries } from '../models/Delivery';
import { payments } from '../models/Payment.js';
import { verifyAuth, requireRole } from '../middleware/auth';
import { generateId } from '../utils/helpers';
import { notify } from '../services/notificationService.js';
import { RewardEngine } from '../services/rewardEngine.js';
import { validate, markPaymentSchema, assignRecyclerSchema } from '../schemas.js';

const router = Router();

/**
 * GET /api/admin/dashboard — headline counters
 */
router.get('/dashboard', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const totalInventory = inventory.length;
    const inventoryByStatus = {};
    inventory.forEach((item) => {
      inventoryByStatus[item.status] = (inventoryByStatus[item.status] || 0) + 1;
    });
    const activeUsers = users.filter((u) => u.isActive).length;
    const usersByRole = {};
    users.forEach((u) => {
      usersByRole[u.role] = (usersByRole[u.role] || 0) + 1;
    });

    const processed = inventory.filter((i) => i.status === 'processed').length;
    const verified = inventory.filter((i) => i.status === 'verified').length;
    const inTransit = inventory.filter((i) => i.status === 'in_transit').length;
    const totalPaid = payments
      .filter((p) => p.status === 'collected')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    res.json({
      metrics: {
        totalInventory,
        inventoryByStatus,
        activeUsers,
        usersByRole,
        totalIntents: intents.length,
        totalDemands: demands.length,
        openDisputes: disputes.filter((d) => d.status === 'open').length,
        verifiedAwaitingAssign: verified,
        inTransit,
        processed,
        totalPaidINR: totalPaid,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users
 */
router.get('/users', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const list = users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      trustLevel: u.trustLevel,
      isActive: u.isActive,
      location: u.location,
      createdAt: u.createdAt,
    }));
    res.json({ users: list, total: list.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/users/:id
 */
router.put('/users/:id', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const user = users.find((u) => u._id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { role, isActive, trustLevel } = req.body;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (trustLevel) user.trustLevel = trustLevel;
    user.updatedAt = new Date().toISOString();

    res.json({ message: 'User updated', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/verified-items — hub-verified items ready to assign to a recycler
 */
router.get('/verified-items', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const items = inventory
      .filter((i) => i.status === 'verified')
      .map((item) => {
        const hub = item.hubId ? users.find((u) => u._id === item.hubId) : null;
        const sourceUser = users.find((u) => u._id === item.sourceUserId);
        return {
          ...item,
          hubName: hub?.name || null,
          sourceUserName: sourceUser?.name || null,
        };
      });

    const recyclers = users
      .filter((u) => u.role === 'recycler' && u.isActive)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        companyName: u.companyName || u.name,
        address: u.location?.address || '',
        ratePerKg: u.ratePerKg || 0,
      }));

    res.json({ items, recyclers, total: items.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/assign-to-recycler
 * body: { inventoryIds: [], recyclerId }
 * Moves items from verified → matched and notifies the recycler.
 */
router.post('/assign-to-recycler', verifyAuth, requireRole('admin'), validate(assignRecyclerSchema), (req, res) => {
  try {
    const { inventoryIds, recyclerId } = req.body;
    const recycler = users.find((u) => u._id === recyclerId && u.role === 'recycler');
    if (!recycler) return res.status(404).json({ error: 'Recycler not found' });

    const now = new Date().toISOString();
    const me = users.find((u) => u._id === req.user.id);
    const updated = [];
    for (const id of inventoryIds) {
      const item = inventory.find((i) => i._id === id);
      if (!item || item.status !== 'verified') continue;
      item.status = 'matched';
      item.recyclerId = recyclerId;
      item.traceability.push({
        actor: req.user.id,
        actorName: me?.name,
        action: 'assigned_to_recycler',
        note: recycler.name,
        timestamp: now,
      });
      item.updatedAt = now;
      updated.push(item);
    }

    if (updated.length > 0) {
      notify(recyclerId, {
        type: 'order_assigned',
        title: 'New order assigned by admin',
        message: `${updated.length} item(s) allocated to you. Open your dashboard to assign a delivery agent.`,
      });
    }

    res.json({ message: `Assigned ${updated.length} item(s) to ${recycler.name}`, updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/orders — every inventory item with full chain (one-stop view)
 */
router.get('/orders', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const orders = inventory.map((item) => {
      const source = users.find((u) => u._id === item.sourceUserId);
      const col = item.collectorId ? users.find((u) => u._id === item.collectorId) : null;
      const hub = item.hubId ? users.find((u) => u._id === item.hubId) : null;
      const rec = item.recyclerId ? users.find((u) => u._id === item.recyclerId) : null;
      const del = item.deliveryWorkerId ? users.find((u) => u._id === item.deliveryWorkerId) : null;
      const pay = payments.find((p) => p.inventoryId === item._id);
      return {
        _id: item._id,
        qrCode: item.qrCode,
        category: item.category,
        status: item.status,
        actualQty: item.actualQty,
        unit: item.unit,
        weightKg: item.weightKg,
        sourceUserName: source?.name,
        collectorName: col?.name,
        hubName: hub?.name,
        recyclerName: rec?.name,
        deliveryWorkerName: del?.name,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        payment: pay || null,
      };
    });
    res.json({ orders, total: orders.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/mark-payment
 * body: { inventoryId, amount, method?, note? }
 * Finalises an inventory item:
 *   inventory.status  → processed
 *   payment record    → collected
 *   rewards awarded   → source_user, collector, hub
 */
router.post('/mark-payment', verifyAuth, requireRole('admin'), validate(markPaymentSchema), (req, res) => {
  try {
    const { inventoryId, amount, method = 'cash', note = '' } = req.body;
    const item = inventory.find((i) => i._id === inventoryId);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    if (item.status !== 'delivered') {
      return res
        .status(409)
        .json({ error: `Item must be in status 'delivered' to collect payment. Current: ${item.status}` });
    }

    const now = new Date().toISOString();

    const payment = {
      _id: generateId(),
      inventoryId,
      recyclerId: item.recyclerId,
      collectedBy: req.user.id,
      amount: Number(amount),
      method,
      note,
      status: 'collected',
      createdAt: now,
    };
    payments.push(payment);

    item.status = 'processed';
    item.processedAt = now;
    item.traceability.push({
      actor: req.user.id,
      actorName: users.find((u) => u._id === req.user.id)?.name,
      action: 'payment_collected',
      note: `₹${payment.amount} via ${method}`,
      timestamp: now,
    });
    item.updatedAt = now;

    // Award points to the three participants
    const awarded = RewardEngine.awardTripleOnProcessed(item);

    // Notify each
    const recycler = users.find((u) => u._id === item.recyclerId);
    const rewardMsg = `Your contribution to item #${item.qrCode} (${item.category}) is complete. Reward points added.`;
    [item.sourceUserId, item.collectorId, item.hubId].filter(Boolean).forEach((uid) =>
      notify(uid, {
        type: 'item_processed',
        title: 'Reward points earned',
        message: rewardMsg,
        relatedId: item._id,
      })
    );
    if (item.recyclerId) {
      notify(item.recyclerId, {
        type: 'payment_recorded',
        title: 'Payment recorded',
        message: `Admin recorded your payment of ₹${payment.amount} for item ${item.qrCode}.`,
      });
    }

    res.json({ message: 'Payment recorded and rewards distributed', payment, item, awarded });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/disputes
 */
router.get('/disputes', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const list = disputes.map((d) => ({
      ...d,
      raisedByUser: users.find((u) => u._id === d.raisedBy)?.name,
      againstUser: users.find((u) => u._id === d.against)?.name,
    }));
    res.json({
      disputes: list,
      total: list.length,
      openDisputes: disputes.filter((d) => d.status === 'open').length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/disputes/:id
 */
router.put('/disputes/:id', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const dispute = disputes.find((d) => d._id === req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    const { resolution } = req.body;
    dispute.status = 'resolved';
    dispute.resolvedBy = req.user.id;
    dispute.resolution = resolution;
    dispute.updatedAt = new Date().toISOString();
    res.json({ message: 'Dispute resolved', dispute });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/audit — flattened traceability
 */
router.get('/audit', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const log = inventory
      .flatMap((item) =>
        item.traceability.map((t) => ({
          itemId: item._id,
          qrCode: item.qrCode,
          category: item.category,
          ...t,
        }))
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json({ auditLog: log, total: log.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/intents
 */
router.get('/intents', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const enriched = intents.map((intent) => {
      const user = users.find((u) => u._id === intent.userId);
      const collector = intent.assignedCollector ? users.find((u) => u._id === intent.assignedCollector) : null;
      return {
        ...intent,
        userName: user?.name || 'Unknown',
        userPhone: user?.phone || '',
        collectorName: collector?.name || null,
      };
    });
    const collectors = users
      .filter((u) => u.role === 'local_collector' && u.isActive)
      .map((u) => ({ _id: u._id, name: u.name, email: u.email, phone: u.phone }));
    res.json({ intents: enriched, collectors, total: enriched.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/assign-collector
 */
router.post('/assign-collector', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const { intentId, collectorId } = req.body;
    if (!intentId || !collectorId) return res.status(400).json({ error: 'intentId and collectorId required' });

    const intent = intents.find((i) => i._id === intentId);
    if (!intent) return res.status(404).json({ error: 'Intent not found' });

    const collector = users.find((u) => u._id === collectorId && u.role === 'local_collector');
    if (!collector) return res.status(404).json({ error: 'Collector not found' });

    intent.assignedCollector = collectorId;
    intent.status = 'assigned';
    intent.updatedAt = new Date().toISOString();

    notify(collectorId, {
      type: 'manual_assignment',
      title: 'Admin assigned a pickup to you',
      message: `A pickup at ${intent.location?.address || 'a nearby address'} has been assigned to you.`,
      relatedId: intent._id,
    });
    notify(intent.userId, {
      type: 'pickup_accepted',
      title: 'Your pickup has been assigned',
      message: `${collector.name} will pick up your e-waste shortly.`,
      relatedId: intent._id,
    });

    res.json({ message: 'Collector assigned', intent, collectorName: collector.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/payments — complete payment ledger
 */
router.get('/payments', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const list = payments.map((p) => {
      const item = inventory.find((i) => i._id === p.inventoryId);
      const recycler = users.find((u) => u._id === p.recyclerId);
      return {
        ...p,
        category: item?.category,
        qrCode: item?.qrCode,
        recyclerName: recycler?.name,
      };
    });
    res.json({ payments: list, total: list.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
