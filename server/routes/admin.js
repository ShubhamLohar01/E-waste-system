import { Router } from 'express';
import { users } from '../models/User.js';
import { inventory } from '../models/Inventory.js';
import { intents } from '../models/Intent.js';
import { disputes } from '../models/Dispute.js';
import { payments } from '../models/Payment.js';
import { recyclerRequests } from '../models/RecyclerRequest.js';
import { verifyAuth, requireRole } from '../middleware/auth.js';
import { nextId, PREFIX } from '../utils/idGenerator.js';
import { notify } from '../services/notificationService.js';
import { recordSale, computePool, splitPool } from '../services/payoutEngine.js';
import { categoryPrices } from '../models/CategoryPrice.js';
import { validate, markPaymentSchema, assignRecyclerSchema, categoryPriceSchema } from '../schemas.js';

const router = Router();

/**
 * GET /api/admin/dashboard — headline counters
 */
router.get('/dashboard', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const processed = inventory.filter((i) => i.status === 'processed').length;
    const verified = inventory.filter((i) => i.status === 'verified').length;
    const inTransit = inventory.filter((i) => i.status === 'in_transit').length;
    const totalPaid = payments
      .filter((p) => p.status === 'collected')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    res.json({
      metrics: {
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
 * GET /api/admin/recycler-requests — recycler requests + the verified stock that
 * could fulfil them. Admin is the broker, so it sees real names on both sides.
 */
router.get('/recycler-requests', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const requests = recyclerRequests
      .map((r) => {
        const recycler = users.find((u) => u._id === r.recyclerId);
        return {
          ...r,
          recyclerName: recycler?.name || 'Unknown',
          recyclerEmail: recycler?.email || '',
          allocatedCount: (r.allocatedInventory || []).length,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Verified stock available to allocate (status verified, not yet assigned).
    const verifiedStock = inventory
      .filter((i) => i.status === 'verified')
      .map((item) => {
        const hub = item.hubId ? users.find((u) => u._id === item.hubId) : null;
        return {
          _id: item._id,
          qrCode: item.qrCode,
          category: item.category,
          actualQty: item.actualQty,
          unit: item.unit,
          weightKg: item.weightKg,
          condition: item.condition,
          hubName: hub?.name || null,
          createdAt: item.createdAt,
        };
      });

    res.json({ requests, verifiedStock, total: requests.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/recycler-requests/:id/approve
 * body: { inventoryIds: [] } — allocate verified items to fulfil the request.
 * Items move verified → matched and are linked to the recycler + request.
 */
router.post('/recycler-requests/:id/approve', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const request = recyclerRequests.find((r) => r._id === req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (['fulfilled', 'rejected', 'cancelled'].includes(request.status)) {
      return res.status(409).json({ error: `Request is already ${request.status}.` });
    }

    const { inventoryIds } = req.body;
    if (!Array.isArray(inventoryIds) || inventoryIds.length === 0) {
      return res.status(400).json({ error: 'inventoryIds (non-empty array) required' });
    }

    const recycler = users.find((u) => u._id === request.recyclerId);
    if (!recycler) return res.status(404).json({ error: 'Recycler not found' });

    const now = new Date().toISOString();
    const me = users.find((u) => u._id === req.user.id);
    const allocated = [];
    const hubIds = new Set();

    for (const id of inventoryIds) {
      const item = inventory.find((i) => i._id === id);
      if (!item || item.status !== 'verified') continue;
      item.status = 'matched';
      item.recyclerId = request.recyclerId;
      item.requestId = request._id;
      item.traceability.push({
        actor: req.user.id,
        actorName: me?.name,
        action: 'assigned_to_recycler',
        note: `via request ${request._id}`,
        timestamp: now,
      });
      item.updatedAt = now;
      allocated.push(item);
      if (item.hubId) hubIds.add(item.hubId);
    }

    if (allocated.length === 0) {
      return res.status(400).json({ error: 'No eligible verified items in the selection.' });
    }

    request.allocatedInventory = [...(request.allocatedInventory || []), ...allocated.map((i) => i._id)];
    const allocatedItems = inventory.filter((i) => request.allocatedInventory.includes(i._id));
    // Measure fulfillment in the request's own unit: kg requests count weight,
    // everything else counts pieces. Summing actualQty against a kg target would
    // mark a 100 kg request "fulfilled" after 100 phones.
    const requestInKg = (request.unit || 'kg').toLowerCase() === 'kg';
    const allocatedQty = allocatedItems.reduce(
      (sum, i) => sum + (requestInKg ? i.weightKg || 0 : i.actualQty || 0),
      0
    );
    request.status = allocatedQty >= request.quantity ? 'fulfilled' : 'partially_approved';
    request.reviewedBy = req.user.id;
    request.updatedAt = now;

    // Notify recycler (no hub identity) and each source hub (no recycler identity).
    notify(request.recyclerId, {
      type: 'request_approved',
      title: 'Material request approved',
      message: `Admin allocated ${allocated.length} item(s) (${allocatedQty} ${request.unit || 'kg'} total) to your ${request.category} request.`,
      relatedId: request._id,
    });
    hubIds.forEach((hubId) =>
      notify(hubId, {
        type: 'stock_allocated',
        title: 'Verified stock allocated',
        message: `Admin routed some of your verified ${request.category} stock to a recycler order.`,
      })
    );

    res.json({
      message: `Allocated ${allocated.length} item(s) to ${recycler.name}`,
      request,
      allocatedCount: allocated.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/recycler-requests/:id/reject — body: { note }
 */
router.post('/recycler-requests/:id/reject', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const request = recyclerRequests.find((r) => r._id === req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (['fulfilled', 'rejected', 'cancelled'].includes(request.status)) {
      return res.status(409).json({ error: `Request is already ${request.status}.` });
    }
    const { note } = req.body;
    request.status = 'rejected';
    request.reviewNote = note || null;
    request.reviewedBy = req.user.id;
    request.updatedAt = new Date().toISOString();

    notify(request.recyclerId, {
      type: 'request_rejected',
      title: 'Material request rejected',
      message: `Your ${request.category} request was not approved.${note ? ` Reason: ${note}` : ''}`,
      relatedId: request._id,
    });

    res.json({ message: 'Request rejected', request });
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
        recyclerRatePerKg: rec?.ratePerKg || 0,
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
 * GET /api/admin/payout-preview?inventoryId=... — what mark-payment would credit.
 */
router.get('/payout-preview', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const item = inventory.find((i) => i._id === req.query.inventoryId);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    const pool = computePool(item.category, item.qualityRating);
    if (!pool.ok) return res.json({ ok: false, error: pool.error });
    const parts = splitPool(pool.X);
    return res.json({ ok: true, X: pool.X, basePrice: pool.basePrice, pct: pool.pct, parts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/mark-payment
 * body: { inventoryId, method?, note? }
 * Finalises an inventory item:
 *   inventory.status  → processed
 *   payment record    → collected (amount = system-computed catalog × grade)
 *   payouts credited  → 60/20/20 ledger entries (user / platform / hub)
 */
router.post('/mark-payment', verifyAuth, requireRole('admin'), validate(markPaymentSchema), (req, res) => {
  try {
    const { inventoryId, method = 'cash', note = '' } = req.body;
    const item = inventory.find((i) => i._id === inventoryId);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    if (item.status !== 'delivered') {
      return res.status(409).json({ error: `Item must be in status 'delivered' to collect payment. Current: ${item.status}` });
    }

    // Value the item and write the 60/20/20 ledger entries (also freezes assessedValue).
    const sale = recordSale(item, req.user.id);
    if (!sale.ok) return res.status(409).json({ error: sale.error });
    const amount = sale.X;

    const now = new Date().toISOString();
    const payment = {
      _id: nextId(PREFIX.PAYMENT),
      inventoryId,
      recyclerId: item.recyclerId,
      collectedBy: req.user.id,
      amount,
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
      note: `₹${amount} via ${method}`,
      timestamp: now,
    });
    item.updatedAt = now;

    [item.sourceUserId, item.hubId].filter(Boolean).forEach((uid) =>
      notify(uid, {
        type: 'item_processed',
        title: 'Payout credited',
        message: `Your earnings for item ${item.qrCode} (${item.category}) have been credited.`,
        relatedId: item._id,
      })
    );
    if (item.recyclerId) {
      notify(item.recyclerId, {
        type: 'payment_recorded',
        title: 'Payment recorded',
        message: `Admin recorded your payment of ₹${amount} for item ${item.qrCode}.`,
      });
    }

    res.json({ message: 'Payment recorded and payouts credited', payment, item, payout: sale.parts });
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
    if (!resolution || !String(resolution).trim()) {
      return res.status(400).json({ error: 'resolution text is required' });
    }
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

/**
 * GET /api/admin/category-prices — current market value per category.
 */
router.get('/category-prices', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const list = [...categoryPrices].sort((a, b) => a.category.localeCompare(b.category));
    const known = [...new Set(inventory.map((i) => i.category).filter(Boolean))].sort();
    res.json({ prices: list, total: list.length, categories: known });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/category-prices — upsert one category's current value.
 */
router.put('/category-prices', verifyAuth, requireRole('admin'), validate(categoryPriceSchema), (req, res) => {
  try {
    const { category, currentValue } = req.body;
    const now = new Date().toISOString();
    let row = categoryPrices.find((c) => c.category === category);
    if (row) {
      row.currentValue = currentValue;
      row.updatedBy = req.user.id;
      row.updatedAt = now;
    } else {
      row = { category, currentValue, updatedBy: req.user.id, updatedAt: now };
      categoryPrices.push(row);
    }
    res.json({ message: 'Price saved', price: row });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
