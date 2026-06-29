import { categoryPrices } from '../models/CategoryPrice.js';
import { earningsLedger } from '../models/EarningsLedger.js';
import { nextId, PREFIX } from '../utils/idGenerator.js';

/**
 * Money payout engine — replaces the old gamification RewardEngine.
 * Value = catalog current value × quality-grade %, split 60/20/20.
 */
export const GRADE_BANDS = [
  { min: 9, max: 10, pct: 0.5 },
  { min: 7, max: 8, pct: 0.4 },
  { min: 5, max: 6, pct: 0.28 },
  { min: 3, max: 4, pct: 0.15 },
  { min: 1, max: 2, pct: 0.08 },
];

export const SPLIT = { user: 0.6, platform: 0.2, hub: 0.2 };

export function gradePercent(grade) {
  const g = Number(grade);
  if (!Number.isFinite(g)) return 0;
  const band = GRADE_BANDS.find((b) => g >= b.min && g <= b.max);
  return band ? band.pct : 0;
}

export function catalogValue(category) {
  const row = categoryPrices.find((c) => c.category === category);
  return row ? Number(row.currentValue) : null;
}

export function computePool(category, grade) {
  const p = catalogValue(category);
  if (p == null) return { ok: false, error: `No catalog price set for "${category}".` };
  const pct = gradePercent(grade);
  if (!pct) return { ok: false, error: 'Item is not graded (quality rating 1–10 required).' };
  return { ok: true, X: Math.round(p * pct), basePrice: p, pct };
}

export function splitPool(X) {
  const user = Math.round(X * SPLIT.user);
  const platform = Math.round(X * SPLIT.platform);
  const hub = X - user - platform; // remainder absorbs rounding so parts sum to X
  return { user, platform, hub };
}

function addEntry(userId, role, type, amountRs, inventoryId, decidedBy) {
  earningsLedger.push({
    _id: nextId(PREFIX.LEDGER),
    userId: userId || null,
    role,
    inventoryId,
    amountRs,
    type,
    decidedBy,
    note: null,
    createdAt: new Date().toISOString(),
  });
}

/** Compute X, freeze it on the item, and write the 60/20/20 ledger entries. Idempotent. */
export function recordSale(item, decidedBy) {
  if (item.assessedValue != null) return { ok: false, error: 'Sale already recorded for this item.' };
  const pool = computePool(item.category, item.qualityRating);
  if (!pool.ok) return pool;
  const parts = splitPool(pool.X);
  item.assessedValue = pool.X;
  if (item.sourceUserId) addEntry(item.sourceUserId, 'small_user', 'user_share', parts.user, item._id, decidedBy);
  addEntry(null, 'platform', 'platform_share', parts.platform, item._id, decidedBy);
  if (item.hubId) addEntry(item.hubId, 'hub', 'hub_share', parts.hub, item._id, decidedBy);
  return { ok: true, X: pool.X, parts };
}

/** Hub-decided payment to the collector who delivered the item. */
export function recordCollectorPayment(collectorId, inventoryId, amountRs, hubId) {
  addEntry(collectorId, 'local_collector', 'collector_payment', amountRs, inventoryId, hubId);
}

export function balanceFor(userId) {
  return earningsLedger
    .filter((e) => e.userId === userId)
    .reduce((sum, e) => sum + Number(e.amountRs || 0), 0);
}

export function ledgerFor(userId) {
  return earningsLedger
    .filter((e) => e.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
