import { users } from '../models/User.js';
import { intents } from '../models/Intent.js';
import { inventory } from '../models/Inventory.js';
import { demands } from '../models/Demand.js';
import { deliveries } from '../models/Delivery.js';
import { disputes } from '../models/Dispute.js';
import { notifications } from '../models/Notification.js';
import { payments } from '../models/Payment.js';
import { rewards } from '../models/Reward.js';
import { recyclerRequests } from '../models/RecyclerRequest.js';

/**
 * Human-readable, monthly-sequential entity IDs.
 *
 *   <PREFIX>-<YYMM><seq>   e.g.  ITEM-2606001
 *
 * - PREFIX identifies the entity type (see PREFIX constants below).
 * - YYMM is the 2-digit year + 2-digit month, so IDs sort and group by month.
 * - seq is a per-(prefix, month) counter, zero-padded to 3 digits (grows past 999).
 *
 * The counter lives in memory but is *seeded from existing data* the first time a
 * given prefix+month is used, so IDs continue from the highest stored value after a
 * restart and never collide with records already in the database.
 */

// prefix → function returning the collection to scan when seeding the counter.
const COLLECTIONS = {
  USR: () => users,
  INT: () => intents,
  ITEM: () => inventory,
  DMD: () => demands,
  DLV: () => deliveries,
  DSP: () => disputes,
  NTF: () => notifications,
  PAY: () => payments,
  RWD: () => rewards,
  REQ: () => recyclerRequests,
};

// Stable prefix constants so call sites don't pass raw strings.
export const PREFIX = {
  USER: 'USR',
  INTENT: 'INT',
  INVENTORY: 'ITEM',
  DEMAND: 'DMD',
  DELIVERY: 'DLV',
  DISPUTE: 'DSP',
  NOTIFICATION: 'NTF',
  PAYMENT: 'PAY',
  REWARD: 'RWD',
  REQUEST: 'REQ',
};

const counters = new Map(); // `${prefix}-${yymm}` → last used sequence number

function yymm(date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

// Highest sequence already present in the collection for this prefix + period.
function seedFromExisting(prefix, period) {
  const collection = COLLECTIONS[prefix]?.() || [];
  const re = new RegExp(`^${prefix}-${period}(\\d+)$`);
  let max = 0;
  for (const row of collection) {
    const m = re.exec(row?._id || '');
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
}

/**
 * Returns the next readable id for the given prefix, e.g. nextId(PREFIX.INVENTORY)
 * → "ITEM-2606001". Unknown prefixes still work (counter just can't seed from data).
 */
export function nextId(prefix) {
  const period = yymm();
  const key = `${prefix}-${period}`;
  let last = counters.get(key);
  if (last == null) last = seedFromExisting(prefix, period);
  const next = last + 1;
  counters.set(key, next);
  return `${prefix}-${period}${String(next).padStart(3, '0')}`;
}
