import { Router } from 'express';
import { inventory } from '../models/Inventory';
import { users } from '../models/User';
import { verifyAuth, requireRole } from '../middleware/auth';
import { maskCode } from '../utils/helpers.js';
import { notify } from '../services/notificationService.js';
import { validate, hubVerifySchema, confirmPrintSchema } from '../schemas.js';
import { boxes } from '../models/Box';
import {
  generateTransactionNo,
  generateBoxPrefix,
  makeBoxId,
  boxQrPayload,
  splitNetWeight,
} from '../utils/boxCodes.js';

const router = Router();

/**
 * GET /api/hub/incoming — items at my hub not yet verified
 */
router.get('/incoming', verifyAuth, requireRole('hub'), (req, res) => {
  try {
    const incomingItems = inventory
      .filter(
        (i) =>
          (i.status === 'at_hub' && (!i.hubId || i.hubId === req.user.id)) ||
          (i.status === 'pending_print' && i.hubId === req.user.id),
      )
      .map((item) => {
        const collector = item.collectorId ? users.find((u) => u._id === item.collectorId) : null;
        const sourceUser = users.find((u) => u._id === item.sourceUserId);
        return {
          ...item,
          collectorName: collector?.name || 'Unknown',
          collectorPhone: collector?.phone || '',
          sourceUserName: sourceUser?.name || 'Unknown',
          pendingBoxCount: boxes.filter((b) => b.inventoryId === item._id && b.status === 'pending_print').length,
        };
      });
    res.json({ incomingItems, total: incomingItems.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/hub/verify — STAGE for printing. Records actual qty/weight/condition,
 * sets the item to pending_print, and creates the box rows for preview.
 * The item is NOT verified until /confirm-print is called.
 */
router.post('/verify', verifyAuth, requireRole('hub'), validate(hubVerifySchema), (req, res) => {
  try {
    const { inventoryId, actualQty, weightKg, condition, category, photos, boxCount } = req.body;
    const item = inventory.find((i) => i._id === inventoryId);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    if (item.status === 'verified') {
      return res.status(409).json({ error: 'Item is already verified.' });
    }

    const now = new Date().toISOString();
    if (item.claimedQty == null) item.claimedQty = item.actualQty;
    if (!item.claimedCategory) item.claimedCategory = item.category;

    item.actualQty = Number(actualQty);
    if (weightKg !== undefined && weightKg !== null && weightKg !== '') item.weightKg = Number(weightKg);
    item.condition = condition || item.condition;
    item.category = category || item.category;
    if (Array.isArray(photos)) item.verificationPhotos.push(...photos);
    item.hubId = req.user.id;
    item.status = 'pending_print';
    item.updatedAt = now;

    const me = users.find((u) => u._id === req.user.id);
    const count = Math.max(1, Math.floor(Number(boxCount) || 1));

    // Reuse existing pending boxes if the count is unchanged; otherwise rebuild.
    let myBoxes = boxes.filter((b) => b.inventoryId === item._id && b.status === 'pending_print');
    if (myBoxes.length !== count) {
      for (let i = boxes.length - 1; i >= 0; i--) {
        if (boxes[i].inventoryId === item._id && boxes[i].status === 'pending_print') boxes.splice(i, 1);
      }
      const transactionNo = generateTransactionNo(boxes.map((b) => b.transactionNo));
      const prefix = generateBoxPrefix(boxes.map((b) => b._id));
      const weights = splitNetWeight(item.weightKg, count);
      myBoxes = [];
      for (let i = 0; i < count; i++) {
        const boxId = makeBoxId(prefix, i + 1);
        const box = {
          _id: boxId,
          transactionNo,
          inventoryId: item._id,
          qrPayload: boxQrPayload(transactionNo, boxId),
          itemName: item.category,
          netWeightKg: weights[i],
          unit: item.unit,
          boxSeq: i + 1,
          boxCount: count,
          hubId: req.user.id,
          hubName: me?.name || '',
          status: 'pending_print',
          recyclerId: null,
          recyclerCompany: null,
          acknowledgedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        boxes.push(box);
        myBoxes.push(box);
      }
    } else {
      // Same box count: refresh mutable fields so the preview reflects this submission.
      const weights = splitNetWeight(item.weightKg, count);
      myBoxes.forEach((b, idx) => {
        b.netWeightKg = weights[idx];
        b.itemName = item.category;
        b.unit = item.unit;
        b.updatedAt = now;
      });
    }

    res.json({
      message: 'Item staged for printing',
      item,
      transactionNo: myBoxes[0]?.transactionNo,
      boxes: myBoxes.map((b) => ({
        boxId: b._id,
        transactionNo: b.transactionNo,
        qrPayload: b.qrPayload,
        itemName: b.itemName,
        netWeightKg: b.netWeightKg,
        unit: b.unit,
        boxSeq: b.boxSeq,
        boxCount: b.boxCount,
        hubName: b.hubName,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/hub/confirm-print — the hub clicked Print. Boxes -> printed,
 * item -> verified, admins notified. This is the ONLY path to 'verified'.
 */
router.post('/confirm-print', verifyAuth, requireRole('hub'), validate(confirmPrintSchema), (req, res) => {
  try {
    const { inventoryId } = req.body;
    const item = inventory.find((i) => i._id === inventoryId);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    if (item.hubId !== req.user.id) return res.status(403).json({ error: 'Not your item' });
    if (item.status !== 'pending_print') {
      return res.status(409).json({ error: `Cannot confirm: item status is '${item.status}'.` });
    }

    const myBoxes = boxes.filter((b) => b.inventoryId === item._id && b.status === 'pending_print');
    if (myBoxes.length === 0) {
      return res.status(400).json({ error: 'No staged boxes to print. Stage the item first.' });
    }

    const now = new Date().toISOString();
    myBoxes.forEach((b) => {
      b.status = 'printed';
      b.updatedAt = now;
    });
    item.status = 'verified';
    item.hubVerifiedAt = now;
    item.updatedAt = now;

    const me = users.find((u) => u._id === req.user.id);
    item.traceability.push({
      actor: req.user.id,
      actorName: me?.name,
      action: 'verified_at_hub',
      timestamp: now,
    });

    const admins = users.filter((u) => u.role === 'admin');
    admins.forEach((a) =>
      notify(a._id, {
        type: 'hub_verified',
        title: 'New verified batch ready',
        message: `${me?.name || 'A hub'} verified ${item.actualQty} × ${item.category} (${myBoxes.length} box${myBoxes.length > 1 ? 'es' : ''}). Awaiting your approval to assign to a recycler.`,
        relatedId: item._id,
      }),
    );

    res.json({ message: 'Printed & verified', item, printedBoxes: myBoxes.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/hub/inventory — my verified stock (and beyond) grouped by category
 */
router.get('/inventory', verifyAuth, requireRole('hub'), (req, res) => {
  try {
    const items = inventory
      .filter(
        (i) =>
          i.hubId === req.user.id &&
          ['verified', 'matched', 'in_transit', 'delivered', 'processed'].includes(i.status)
      )
      .map((item) => {
        const sourceUser = users.find((u) => u._id === item.sourceUserId);
        // Recycler identity hidden from hubs — only an opaque recycler code.
        return {
          ...item,
          sourceUserName: sourceUser?.name || 'Unknown',
          recyclerCode: maskCode(item.recyclerId, 'REC'),
          boxes: boxes
            .filter((bx) => bx.inventoryId === item._id)
            .sort((x, y) => x.boxSeq - y.boxSeq)
            .map((bx) => ({
              boxId: bx._id,
              transactionNo: bx.transactionNo,
              netWeightKg: bx.netWeightKg,
              boxSeq: bx.boxSeq,
              boxCount: bx.boxCount,
              status: bx.status,
            })),
        };
      });

    const grouped = {};
    items.forEach((item) => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    res.json({ verifiedItems: items, groupedByCategory: grouped, total: items.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/hub/flag — record discrepancy
 */
router.post('/flag', verifyAuth, requireRole('hub'), (req, res) => {
  try {
    const { inventoryId, reason, evidence } = req.body;
    if (!inventoryId || !reason) return res.status(400).json({ error: 'inventoryId and reason required' });

    const item = inventory.find((i) => i._id === inventoryId);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });

    const now = new Date().toISOString();
    item.traceability.push({
      actor: req.user.id,
      actorName: users.find((u) => u._id === req.user.id)?.name,
      action: 'flagged_discrepancy',
      note: reason,
      timestamp: now,
      photo: Array.isArray(evidence) ? evidence[0] : undefined,
    });
    item.updatedAt = now;

    res.json({ message: 'Discrepancy flagged', item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
