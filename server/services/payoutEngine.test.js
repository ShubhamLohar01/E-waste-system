import { describe, it, expect, beforeEach } from 'vitest';
import { categoryPrices } from '../models/CategoryPrice.js';
import { earningsLedger } from '../models/EarningsLedger.js';
import { gradePercent, splitPool, computePool, recordSale, balanceFor } from './payoutEngine.js';

beforeEach(() => {
  categoryPrices.length = 0;
  earningsLedger.length = 0;
});

describe('gradePercent', () => {
  it('maps grade bands to percentages', () => {
    expect(gradePercent(10)).toBe(0.5);
    expect(gradePercent(9)).toBe(0.5);
    expect(gradePercent(8)).toBe(0.4);
    expect(gradePercent(5)).toBe(0.28);
    expect(gradePercent(3)).toBe(0.15);
    expect(gradePercent(1)).toBe(0.08);
  });
  it('returns 0 for ungraded / out of range', () => {
    expect(gradePercent(0)).toBe(0);
    expect(gradePercent(null)).toBe(0);
    expect(gradePercent(11)).toBe(0);
  });
});

describe('splitPool', () => {
  it('splits 60/20/20 and the parts always sum to X', () => {
    expect(splitPool(500)).toEqual({ user: 300, platform: 100, hub: 100 });
    const s = splitPool(497); // 298.2 / 99.4 / remainder
    expect(s.user + s.platform + s.hub).toBe(497);
  });
});

describe('computePool', () => {
  it('errors when no catalog price exists', () => {
    const r = computePool('Mobile Phones', 10);
    expect(r.ok).toBe(false);
  });
  it('errors when the item is ungraded', () => {
    categoryPrices.push({ category: 'Mobile Phones', currentValue: 1000 });
    const r = computePool('Mobile Phones', 0);
    expect(r.ok).toBe(false);
  });
  it('computes X = catalogValue × gradePercent', () => {
    categoryPrices.push({ category: 'Mobile Phones', currentValue: 1000 });
    const r = computePool('Mobile Phones', 10);
    expect(r).toMatchObject({ ok: true, X: 500 });
  });
});

describe('recordSale', () => {
  it('writes user/platform/hub ledger entries and freezes assessedValue', () => {
    categoryPrices.push({ category: 'Mobile Phones', currentValue: 1000 });
    const item = { _id: 'ITEM-1', category: 'Mobile Phones', qualityRating: 10, sourceUserId: 'USR-1', hubId: 'HUB-1' };
    const r = recordSale(item, 'ADM-1');
    expect(r.ok).toBe(true);
    expect(item.assessedValue).toBe(500);
    expect(balanceFor('USR-1')).toBe(300);
    expect(balanceFor('HUB-1')).toBe(100);
    expect(earningsLedger.filter((e) => e.type === 'platform_share')).toHaveLength(1);
  });
  it('is idempotent — a second call does not double-pay', () => {
    categoryPrices.push({ category: 'Mobile Phones', currentValue: 1000 });
    const item = { _id: 'ITEM-1', category: 'Mobile Phones', qualityRating: 10, sourceUserId: 'USR-1', hubId: 'HUB-1' };
    recordSale(item, 'ADM-1');
    const r2 = recordSale(item, 'ADM-1');
    expect(r2.ok).toBe(false);
    expect(balanceFor('USR-1')).toBe(300);
  });
});
