import { z } from 'zod';

export const PUBLIC_ROLES = [
  'small_user',
  'local_collector',
  'hub',
  'delivery_worker',
  'recycler',
  'bulk_generator',
];

const locationSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  address: z.string().max(500).optional().default(''),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(200),
  phone: z.string().max(30).optional().default(''),
  role: z.enum(PUBLIC_ROLES),
  location: locationSchema.partial().optional(),
});

export const registerWithEmailSchema = z.object({
  verifyToken: z.string().min(10),
  name: z.string().min(2).max(100),
  role: z.enum(PUBLIC_ROLES),
  address: z.string().min(3).max(500),
});

export const intentSchema = z.object({
  items: z
    .array(
      z.object({
        category: z.string().min(1).max(100),
        estimatedQty: z.number().positive().max(10_000),
        unit: z.string().max(20),
        photos: z.array(z.string()).optional().default([]),
        invoice: z
          .object({
            name: z.string().max(255).optional().default(''),
            dataUrl: z.string(),
          })
          .nullable()
          .optional(),
        condition: z.string().max(50).optional(),
        purchaseDate: z.string().max(30).optional(),
      })
    )
    .min(1)
    .max(50),
  location: locationSchema.optional().default({ address: '' }),
});

export const hubVerifySchema = z.object({
  inventoryId: z.string().min(1),
  actualQty: z.number().nonnegative(),
  weightKg: z.number().nonnegative().nullable().optional(),
  condition: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  photos: z.array(z.string()).optional(),
  boxCount: z.number().int().positive().max(1000).optional().default(1),
});

export const confirmPrintSchema = z.object({
  inventoryId: z.string().min(1),
});

export const acknowledgeBoxSchema = z.object({
  scannedQr: z.string().min(1),
});

export const markPaymentSchema = z.object({
  inventoryId: z.string().min(1),
  method: z.enum(['bank_transfer', 'upi', 'cash', 'cheque']).optional(),
  note: z.string().max(500).optional(),
});

export const assignRecyclerSchema = z.object({
  inventoryIds: z.array(z.string().min(1)).min(1).max(500),
  recyclerId: z.string().min(1),
});

export const assignDeliverySchema = z.object({
  inventoryIds: z.array(z.string().min(1)).min(1).max(500),
  deliveryWorkerId: z.string().min(1),
});

export const recyclerQualitySchema = z.object({
  inventoryId: z.string().min(1),
  technicianName: z.string().min(2).max(100),
  qualityRating: z.number().int().min(1).max(10),
});

export const recyclerRequestSchema = z.object({
  category: z.string().min(1).max(100),
  quantity: z.number().positive().max(10_000_000),
  unit: z.string().max(20).optional().default('kg'),
  note: z.string().max(1000).optional(),
  targetDate: z.string().max(30).optional(),
});

export const disputeCreateSchema = z.object({
  againstUserId: z.string().min(1).optional(),
  relatedInventoryId: z.string().min(1).optional(),
  type: z.enum(['quantity_mismatch', 'quality_mismatch', 'non_delivery', 'damaged_item', 'other']),
  description: z.string().min(5).max(1000),
  evidence: z.array(z.string()).optional().default([]),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(30).optional(),
  location: locationSchema.optional(),
});

export const categoryPriceSchema = z.object({
  category: z.string().min(1).max(100),
  currentValue: z.number().nonnegative().max(100_000_000),
});

export const collectorPaymentSchema = z.object({
  inventoryId: z.string().min(1),
  amountRs: z.number().positive().max(10_000_000),
});

/**
 * Generic middleware: `validate(schema)` → 400 on failure with concise field/message.
 */
export function validate(schema) {
  return (req, res, next) => {
    const r = schema.safeParse(req.body);
    if (!r.success) {
      const first = r.error.issues[0];
      return res.status(400).json({
        error: `${first.path.join('.') || 'body'}: ${first.message}`,
        issues: r.error.issues,
      });
    }
    req.body = r.data;
    next();
  };
}
