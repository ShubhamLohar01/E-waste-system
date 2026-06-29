import { Router } from 'express';
import { disputes } from '../models/Dispute.js';
import { users } from '../models/User.js';
import { inventory } from '../models/Inventory.js';
import { verifyAuth } from '../middleware/auth.js';
import { nextId, PREFIX } from '../utils/idGenerator.js';
import { validate, disputeCreateSchema } from '../schemas.js';
import { notify } from '../services/notificationService.js';

const router = Router();

/**
 * POST /api/disputes — anyone authenticated can raise a dispute.
 * Either against a specific user (`againstUserId`) or about a specific inventory item.
 */
router.post('/', verifyAuth, validate(disputeCreateSchema), (req, res) => {
  const { againstUserId, relatedInventoryId, type, description, evidence } = req.body;

  if (againstUserId && againstUserId === req.user.id) {
    return res.status(400).json({ error: 'You cannot raise a dispute against yourself' });
  }
  if (againstUserId) {
    const target = users.find((u) => u._id === againstUserId);
    if (!target) return res.status(404).json({ error: 'Target user not found' });
  }
  let item = null;
  if (relatedInventoryId) {
    item = inventory.find((i) => i._id === relatedInventoryId);
    if (!item) return res.status(404).json({ error: 'Related inventory item not found' });
  }

  const dispute = {
    _id: nextId(PREFIX.DISPUTE),
    raisedBy: req.user.id,
    against: againstUserId || null,
    deliveryId: null,
    inventoryId: relatedInventoryId || null,
    type,
    description,
    evidence,
    status: 'open',
    resolvedBy: null,
    resolution: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  disputes.push(dispute);

  // Notify all admins
  const admins = users.filter((u) => u.role === 'admin');
  const raisedByUser = users.find((u) => u._id === req.user.id);
  admins.forEach((a) =>
    notify(a._id, {
      type: 'dispute_opened',
      title: 'New dispute filed',
      message: `${raisedByUser?.name || 'A user'} raised a "${type.replace('_', ' ')}" dispute${item ? ` about ${item.category}` : ''}.`,
      relatedId: dispute._id,
    })
  );

  // Notify the target user (if any) that someone disputed against them
  if (againstUserId) {
    notify(againstUserId, {
      type: 'dispute_against_you',
      title: 'A dispute was filed against you',
      message: `Type: ${type.replace('_', ' ')}. Admin will review.`,
      relatedId: dispute._id,
    });
  }

  res.status(201).json({ message: 'Dispute filed', dispute });
});

/**
 * GET /api/disputes/mine — my own disputes (raised by me or against me).
 */
router.get('/mine', verifyAuth, (req, res) => {
  const mine = disputes
    .filter((d) => d.raisedBy === req.user.id || d.against === req.user.id)
    .map((d) => ({
      ...d,
      raisedByName: users.find((u) => u._id === d.raisedBy)?.name,
      againstName: users.find((u) => u._id === d.against)?.name,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ disputes: mine, total: mine.length });
});

export default router;
