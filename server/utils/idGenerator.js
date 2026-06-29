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
import { earningsLedger } from '../models/EarningsLedger.js';

/**
 * Human-readable, monthly-sequential entity IDs.
 *
 *   <PREFIX>-<YYYYMM><seq>   e.g.  ITEM-202606001,  HUB-202606001
 *
 * - PREFIX identifies the entity type / user role (see constants below).
 * - YYYYMM is the 4-digit year + 2-digit month, so IDs sort and group by month.
 * - seq is a per-(prefix, month) counter, zero-padded to 3 digits (grows past 999).
 *
 * Users are prefixed by ROLE (HUB / RCY / COL / DEL / USR / BLK / ADM) via
 * nextUserId(role); every other entity uses its PREFIX via nextId(prefix).
 *
 * The counter lives in memory but is *seeded from existing data* the first time a
 * given prefix+month is used, so IDs continue from the highest stored value after a
 * restart and never collide with records already in the database.
 */

// prefix → function returning the collection to scan when seeding the counter.
const COLLECTIONS = {
  // user-role prefixes all live in the users collection
  HUB: () => users,
  RCY: () => users,
  COL: () => users,
  DEL: () => users,
  USR: () => users,
  BLK: () => users,
  ADM: () => users,
  // entity prefixes
  INT: () => intents,
  ITEM: () => inventory,
  DMD: () => demands,
  DLV: () => deliveries,
  DSP: () => disputes,
  NTF: () => notifications,
  PAY: () => payments,
  RWD: () => rewards,
  REQ: () => recyclerRequests,
  LE: () => earningsLedger,
};

// User-id prefix per role, e.g. a hub → HUB-202606001.
export const ROLE_PREFIX = {
  hub: 'HUB',
  recycler: 'RCY',
  local_collector: 'COL',
  delivery_worker: 'DEL',
  small_user: 'USR',
  bulk_generator: 'BLK',
  admin: 'ADM',
};

// Stable prefix constants for non-user entities so call sites don't pass raw strings.
export const PREFIX = {
  USER: 'USR', // generic fallback — prefer nextUserId(role) for role-based user ids
  INTENT: 'INT',
  INVENTORY: 'ITEM',
  DEMAND: 'DMD',
  DELIVERY: 'DLV',
  DISPUTE: 'DSP',
  NOTIFICATION: 'NTF',
  PAYMENT: 'PAY',
  REWARD: 'RWD',
  REQUEST: 'REQ',
  LEDGER: 'LE',
};

const counters = new Map(); // `${prefix}-${yyyymm}` → last used sequence number

function yyyymm(date = new Date()) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yyyy}${mm}`;
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
  const period = yyyymm();
  const key = `${prefix}-${period}`;
  let last = counters.get(key);
  if (last == null) last = seedFromExisting(prefix, period);
  const next = last + 1;
  counters.set(key, next);
  return `${prefix}-${period}${String(next).padStart(3, '0')}`;
}

/** Role-based user id, e.g. nextUserId('hub') → "HUB-202606001". */
export function nextUserId(role) {
  return nextId(ROLE_PREFIX[role] || 'USR');
}
