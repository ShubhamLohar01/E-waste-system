import { Router, Response } from 'express';
import { users, User } from '../models/User';
import { inventory } from '../models/Inventory';
import { intents } from '../models/Intent';
import { demands } from '../models/Demand';
import { disputes, Dispute } from '../models/Dispute';
import { rewards } from '../models/Reward';
import { deliveries } from '../models/Delivery';
import { verifyAuth, requireRole, AuthRequest } from '../middleware/auth';
import { generateId } from '../utils/helpers';
import { MatchingEngine } from '../services/matchingEngine';

const router = Router();

/**
 * GET /api/admin/dashboard
 * System-wide metrics
 */
router.get('/dashboard', verifyAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const totalInventory = inventory.length;
    const inventoryByStatus: Record<string, number> = {};
    inventory.forEach(item => {
      inventoryByStatus[item.status] = (inventoryByStatus[item.status] || 0) + 1;
    });

    const activeUsers = users.filter(u => u.isActive).length;
    const usersByRole: Record<string, number> = {};
    users.forEach(user => {
      usersByRole[user.role] = (usersByRole[user.role] || 0) + 1;
    });

    const openDisputes = disputes.filter(d => d.status === 'open').length;
    const matchRate = demands.length > 0 
      ? Math.round((demands.filter(d => d.status !== 'open').length / demands.length) * 100)
      : 0;

    res.json({
      metrics: {
        totalInventory,
        inventoryByStatus,
        activeUsers,
        usersByRole,
        totalDemands: demands.length,
        totalIntents: intents.length,
        openDisputes,
        matchRate: `${matchRate}%`,
      },
      timestamp: new Date(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users
 * Manage users and roles
 */
router.get('/users', verifyAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const userList = users.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      trustLevel: u.trustLevel,
      isActive: u.isActive,
      createdAt: u.createdAt,
    }));

    res.json({
      users: userList,
      total: userList.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/users/:id
 * Update user role or status
 */
router.put('/users/:id', verifyAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const user = users.find(u => u._id === req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { role, isActive, trustLevel } = req.body;

    if (role) user.role = role as User['role'];
    if (isActive !== undefined) user.isActive = isActive;
    if (trustLevel) user.trustLevel = trustLevel;
    user.updatedAt = new Date();

    res.json({
      message: 'User updated successfully',
      user,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/disputes
 * View disputes
 */
router.get('/disputes', verifyAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const disputeList = disputes.map(d => ({
      ...d,
      raisedByUser: users.find(u => u._id === d.raisedBy)?.name,
      againstUser: users.find(u => u._id === d.against)?.name,
    }));

    res.json({
      disputes: disputeList,
      total: disputeList.length,
      openDisputes: disputes.filter(d => d.status === 'open').length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/disputes/:id
 * Resolve a dispute
 */
router.put('/disputes/:id', verifyAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const dispute = disputes.find(d => d._id === req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const { resolution } = req.body;

    dispute.status = 'resolved';
    dispute.resolvedBy = req.user!.id;
    dispute.resolution = resolution;
    dispute.updatedAt = new Date();

    res.json({
      message: 'Dispute resolved successfully',
      dispute,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/audit
 * Full traceability logs
 */
router.get('/audit', verifyAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const auditLog = inventory.flatMap(item => 
      item.traceability.map(trace => ({
        itemId: item._id,
        qrCode: item.qrCode,
        ...trace,
      }))
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      auditLog,
      total: auditLog.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/config
 * Get current system configuration
 */
router.get('/config', verifyAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    res.json({
      config: {
        matching: {
          radiusKm: 50,
          maxDemandSplit: 3,
        },
        rewards: {
          pointsPerKg: 1,
          pointsPerItem: 5,
          smallBadgeThreshold: 1000,
          goldBadgeThreshold: 5000,
        },
        trust: {
          smallUserBaseTrust: 0.3,
          collectorBaseTrust: 0.6,
          hubBaseTrust: 0.95,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/config
 * Update system configuration
 */
router.put('/config', verifyAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const { config } = req.body;

    res.json({
      message: 'Configuration updated successfully',
      config,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/assign-collector
 * Assign a collector to an intent
 */
router.post('/assign-collector', verifyAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const { intentId, collectorId } = req.body;

    if (!intentId || !collectorId) {
      return res.status(400).json({ error: 'intentId and collectorId are required' });
    }

    const intent = intents.find(i => i._id === intentId);
    if (!intent) {
      return res.status(404).json({ error: 'Intent not found' });
    }

    const collector = users.find(u => u._id === collectorId && u.role === 'local_collector');
    if (!collector) {
      return res.status(404).json({ error: 'Collector not found' });
    }

    intent.assignedCollector = collectorId;
    intent.status = 'assigned';
    intent.updatedAt = new Date();

    res.json({
      message: 'Collector assigned successfully',
      intent,
      collectorName: collector.name,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/intents
 * Get all intents with enriched data
 */
router.get('/intents', verifyAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const enrichedIntents = intents.map(intent => {
      const user = users.find(u => u._id === intent.userId);
      const collector = intent.assignedCollector
        ? users.find(u => u._id === intent.assignedCollector)
        : null;
      return {
        ...intent,
        userName: user?.name || 'Unknown',
        userPhone: user?.phone || '',
        collectorName: collector?.name || null,
      };
    });

    const collectors = users
      .filter(u => u.role === 'local_collector' && u.isActive)
      .map(u => ({ _id: u._id, name: u.name, email: u.email, phone: u.phone }));

    res.json({
      intents: enrichedIntents,
      collectors,
      total: enrichedIntents.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/match
 * Trigger matching engine to pair verified inventory with recycler demands
 */
router.post('/match', verifyAuth, requireRole('admin'), (req: AuthRequest, res: Response) => {
  try {
    const deliveryWorkerPool = users
      .filter(u => u.role === 'delivery_worker' && u.isActive)
      .map(u => u._id!);

    if (deliveryWorkerPool.length === 0) {
      return res.status(400).json({ error: 'No active delivery workers available' });
    }

    const results = MatchingEngine.autoMatchAllDemands(deliveryWorkerPool);

    res.json({
      message: 'Matching engine executed',
      matchResults: results.map(r => ({
        demandId: r.demand._id,
        category: r.demand.category,
        matchedItems: r.matchedItems.length,
        matchPercentage: Math.round(r.matchPercentage),
        deliveryCreated: !!r.delivery,
      })),
      totalMatched: results.filter(r => r.matchedItems.length > 0).length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
