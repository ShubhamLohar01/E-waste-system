import { Router } from 'express';
import { verifyAuth } from '../middleware/auth.js';
import { balanceFor, ledgerFor } from '../services/payoutEngine.js';
import { inventory } from '../models/Inventory.js';

const router = Router();

/**
 * GET /api/earnings/mine — money balance + ledger for the logged-in user (any role).
 */
router.get('/mine', verifyAuth, (req, res) => {
  try {
    const entries = ledgerFor(req.user.id).map((e) => {
      const item = e.inventoryId ? inventory.find((i) => i._id === e.inventoryId) : null;
      return { ...e, category: item?.category || null, qrCode: item?.qrCode || null };
    });
    res.json({ balanceRs: balanceFor(req.user.id), entries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
