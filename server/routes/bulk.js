import { Router } from 'express';
import { intents } from '../models/Intent.js';
import { inventory } from '../models/Inventory.js';
import { verifyAuth, requireRole } from '../middleware/auth.js';
import { generateQRCode } from '../utils/helpers.js';
import { nextId, PREFIX } from '../utils/idGenerator.js';

const router = Router();

/**
 * POST /api/bulk-intent
 * Submit bulk e-waste manifest
 */
router.post('/intent', verifyAuth, requireRole('bulk_generator'), (req, res) => {
  try {
    const { items, location } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array required' });
    }

    const intent = {
      _id: nextId(PREFIX.INTENT),
      userId: req.user.id,
      type: 'bulk_generator',
      items: items.map(item => ({
        category: item.category,
        estimatedQty: item.estimatedQty,
        unit: item.unit,
        photos: item.photos || [],
      })),
      status: 'submitted',
      location: location || { lat: 0, lng: 0, address: '' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    intents.push(intent);

    // Create inventory items for bulk
    for (const item of items) {
      const invId = nextId(PREFIX.INVENTORY);
      const inventoryItem = {
        _id: invId,
        qrCode: generateQRCode(invId),
        intentId: intent._id,
        category: item.category,
        actualQty: item.estimatedQty,
        unit: item.unit,
        condition: 'bulk_generator',
        status: 'submitted',
        sourceUserId: req.user.id,
        verificationPhotos: item.photos || [],
        traceability: [
          {
            actor: req.user.id,
            action: 'bulk_intent_submitted',
            timestamp: new Date(),
            qrScanned: false,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inventory.push(inventoryItem);
    }

    res.status(201).json({
      message: 'Bulk manifest submitted successfully',
      intent,
      certificateId: `CERT-${intent._id}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bulk-intent/:id
 * Track bulk submission status
 */
router.get('/intent/:id', verifyAuth, requireRole('bulk_generator'), (req, res) => {
  try {
    const intent = intents.find(i => i._id === req.params.id && i.type === 'bulk_generator');
    if (!intent) {
      return res.status(404).json({ error: 'Bulk intent not found' });
    }

    if (intent.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const inventoryItems = inventory.filter(i => i.intentId === intent._id);

    res.json({
      intent,
      inventoryItems,
      itemsVerified: inventoryItems.filter(i => i.status === 'verified').length,
      itemsTotal: inventoryItems.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/certificates
 * View compliance certificates
 */
router.get('/certificates', verifyAuth, requireRole('bulk_generator'), (req, res) => {
  try {
    const myIntents = intents.filter(i => i.userId === req.user.id && i.type === 'bulk_generator');
    const certificates = myIntents.map(intent => ({
      certificateId: `CERT-${intent._id}`,
      intentId: intent._id,
      generatedDate: intent.createdAt,
      status: intent.status,
      items: intent.items.length,
      totalQty: intent.items.reduce((sum, item) => sum + item.estimatedQty, 0),
    }));

    res.json({
      certificates,
      total: certificates.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
