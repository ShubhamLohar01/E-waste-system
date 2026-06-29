import { describe, it, expect } from 'vitest';
import { hubVerifySchema, confirmPrintSchema, acknowledgeBoxSchema } from './schemas.js';
import { categoryPriceSchema } from './schemas.js';

describe('hubVerifySchema', () => {
  it('defaults boxCount to 1 when omitted', () => {
    const parsed = hubVerifySchema.parse({ inventoryId: 'ITEM-1', actualQty: 3 });
    expect(parsed.boxCount).toBe(1);
  });

  it('accepts a positive integer boxCount', () => {
    const parsed = hubVerifySchema.parse({ inventoryId: 'ITEM-1', actualQty: 3, boxCount: 4 });
    expect(parsed.boxCount).toBe(4);
  });

  it('rejects boxCount < 1', () => {
    expect(() => hubVerifySchema.parse({ inventoryId: 'ITEM-1', actualQty: 3, boxCount: 0 })).toThrow();
  });
});

describe('confirmPrintSchema / acknowledgeBoxSchema', () => {
  it('requires inventoryId', () => {
    expect(() => confirmPrintSchema.parse({})).toThrow();
    expect(confirmPrintSchema.parse({ inventoryId: 'ITEM-1' })).toEqual({ inventoryId: 'ITEM-1' });
  });

  it('requires scannedQr', () => {
    expect(() => acknowledgeBoxSchema.parse({})).toThrow();
    expect(acknowledgeBoxSchema.parse({ scannedQr: 'BOX.x.y.z' })).toEqual({ scannedQr: 'BOX.x.y.z' });
  });
});

describe('categoryPriceSchema', () => {
  it('accepts a valid category price', () => {
    const r = categoryPriceSchema.safeParse({ category: 'Mobile Phones', currentValue: 1000 });
    expect(r.success).toBe(true);
  });
  it('rejects a negative price', () => {
    const r = categoryPriceSchema.safeParse({ category: 'Mobile Phones', currentValue: -5 });
    expect(r.success).toBe(false);
  });
  it('rejects an empty category', () => {
    const r = categoryPriceSchema.safeParse({ category: '', currentValue: 10 });
    expect(r.success).toBe(false);
  });
});
