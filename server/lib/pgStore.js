/**
 * Postgres-backed write-through store.
 *
 *  - hydrateAll(): load every table from Postgres into the in-memory model arrays at boot.
 *  - flushAll()  : persist the in-memory arrays back to Postgres (whole-table rewrite,
 *                  mirroring the previous JSON "rewrite the file" semantics).
 *  - scheduleFlush(): fire-and-forget, coalesced flush used by the persistAll middleware.
 *
 * The model arrays hold objects in the original shape (_id + camelCase), so routes are
 * unchanged. Mapping between that shape and snake_case columns lives here.
 */
import { pool } from './db.js';
import { users } from '../models/User.js';
import { categoryPrices } from '../models/CategoryPrice.js';
import { intents } from '../models/Intent.js';
import { demands } from '../models/Demand.js';
import { inventory } from '../models/Inventory.js';
import { deliveries } from '../models/Delivery.js';
import { disputes } from '../models/Dispute.js';
import { notifications } from '../models/Notification.js';
import { payments } from '../models/Payment.js';
import { rewards } from '../models/Reward.js';
import { recyclerRequests } from '../models/RecyclerRequest.js';
import { boxes } from '../models/Box.js';
import { earningsLedger } from '../models/EarningsLedger.js';

const iso = (v) => (v instanceof Date ? v.toISOString() : v);
const arr = (v) => (Array.isArray(v) ? v : []);
const nz = (v) => (v === '' || v === undefined ? null : v);

// Ordered parent → child so inserts satisfy FKs (deletes run in reverse).
const TABLES = [
  {
    name: 'users',
    array: users,
    columns: ['id', 'name', 'email', 'password', 'phone', 'role', 'trust_level', 'location', 'avatar_url', 'is_active', 'created_at', 'updated_at'],
    jsonb: ['location'],
    fromRow: (r) => ({ _id: r.id, name: r.name, email: r.email, password: r.password, phone: r.phone, role: r.role, trustLevel: r.trust_level, location: r.location, avatarUrl: r.avatar_url, isActive: r.is_active, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) }),
    toRow: (r) => [r._id, r.name, r.email, r.password, r.phone ?? '', r.role, r.trustLevel ?? 'standard', JSON.stringify(r.location ?? {}), r.avatarUrl ?? null, r.isActive ?? true, r.createdAt, r.updatedAt],
  },
  {
    name: 'category_prices',
    array: categoryPrices,
    columns: ['category', 'current_value', 'updated_by', 'updated_at'],
    jsonb: [],
    fromRow: (r) => ({ category: r.category, currentValue: r.current_value, updatedBy: r.updated_by, updatedAt: iso(r.updated_at) }),
    toRow: (r) => [r.category, r.currentValue, nz(r.updatedBy), r.updatedAt],
  },
  {
    // Table renamed intents -> usr_req_items; in-memory array stays `intents`.
    name: 'usr_req_items',
    array: intents,
    columns: ['id', 'user_id', 'username', 'type', 'items', 'status', 'assigned_collector', 'location', 'created_at', 'updated_at'],
    jsonb: ['items', 'location'],
    fromRow: (r) => ({ _id: r.id, userId: r.user_id, username: r.username, type: r.type, items: r.items, status: r.status, assignedCollector: r.assigned_collector, location: r.location, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) }),
    toRow: (r) => [r._id, nz(r.userId), nz(r.username), r.type, JSON.stringify(arr(r.items)), r.status ?? 'submitted', nz(r.assignedCollector), JSON.stringify(r.location ?? {}), r.createdAt, r.updatedAt],
  },
  {
    name: 'demands',
    array: demands,
    columns: ['id', 'recycler_id', 'category', 'quantity_needed', 'unit', 'delivery_window', 'status', 'matched_inventory', 'created_at', 'updated_at'],
    jsonb: ['delivery_window', 'matched_inventory'],
    fromRow: (r) => ({ _id: r.id, recyclerId: r.recycler_id, category: r.category, quantityNeeded: r.quantity_needed, unit: r.unit, deliveryWindow: r.delivery_window, status: r.status, matchedInventory: r.matched_inventory, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) }),
    toRow: (r) => [r._id, nz(r.recyclerId), r.category, r.quantityNeeded, r.unit, JSON.stringify(r.deliveryWindow ?? {}), r.status ?? 'open', JSON.stringify(arr(r.matchedInventory)), r.createdAt, r.updatedAt],
  },
  {
    name: 'inventory',
    array: inventory,
    columns: ['id', 'qr_code', 'intent_id', 'category', 'claimed_category', 'actual_qty', 'claimed_qty', 'unit', 'weight_kg', 'condition', 'status', 'source_user_id', 'collector_id', 'hub_id', 'delivery_worker_id', 'recycler_id', 'matched_demand_id', 'verification_photos', 'traceability', 'quality_rating', 'technician_name', 'assessed_value', 'original_price', 'created_at', 'updated_at'],
    jsonb: ['traceability'],
    fromRow: (r) => ({ _id: r.id, qrCode: r.qr_code, intentId: r.intent_id, category: r.category, claimedCategory: r.claimed_category, actualQty: r.actual_qty, claimedQty: r.claimed_qty, unit: r.unit, weightKg: r.weight_kg, condition: r.condition, status: r.status, sourceUserId: r.source_user_id, collectorId: r.collector_id, hubId: r.hub_id, deliveryWorkerId: r.delivery_worker_id, recyclerId: r.recycler_id, matchedDemandId: r.matched_demand_id, verificationPhotos: r.verification_photos, traceability: r.traceability, qualityRating: r.quality_rating, technicianName: r.technician_name, assessedValue: r.assessed_value, originalPrice: r.original_price, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) }),
    toRow: (r) => [r._id, nz(r.qrCode), nz(r.intentId), r.category, r.claimedCategory, r.actualQty, r.claimedQty, r.unit, r.weightKg ?? null, r.condition, r.status, nz(r.sourceUserId), nz(r.collectorId), nz(r.hubId), nz(r.deliveryWorkerId), nz(r.recyclerId), nz(r.matchedDemandId), arr(r.verificationPhotos), JSON.stringify(arr(r.traceability)), r.qualityRating ?? null, r.technicianName ?? null, r.assessedValue ?? null, r.originalPrice ?? null, r.createdAt, r.updatedAt],
  },
  {
    name: 'boxes',
    array: boxes,
    columns: ['id', 'transaction_no', 'inventory_id', 'qr_payload', 'item_name', 'net_weight_kg', 'unit', 'box_seq', 'box_count', 'hub_id', 'hub_name', 'status', 'recycler_id', 'recycler_company', 'acknowledged_at', 'created_at', 'updated_at'],
    jsonb: [],
    fromRow: (r) => ({ _id: r.id, transactionNo: r.transaction_no, inventoryId: r.inventory_id, qrPayload: r.qr_payload, itemName: r.item_name, netWeightKg: r.net_weight_kg, unit: r.unit, boxSeq: r.box_seq, boxCount: r.box_count, hubId: r.hub_id, hubName: r.hub_name, status: r.status, recyclerId: r.recycler_id, recyclerCompany: r.recycler_company, acknowledgedAt: iso(r.acknowledged_at), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) }),
    toRow: (r) => [r._id, r.transactionNo, nz(r.inventoryId), nz(r.qrPayload), r.itemName ?? null, r.netWeightKg ?? null, r.unit ?? null, r.boxSeq ?? null, r.boxCount ?? null, nz(r.hubId), r.hubName ?? null, r.status ?? 'pending_print', nz(r.recyclerId), r.recyclerCompany ?? null, r.acknowledgedAt ?? null, r.createdAt, r.updatedAt],
  },
  {
    name: 'deliveries',
    array: deliveries,
    columns: ['id', 'delivery_worker_id', 'pickup_hub', 'dropoff_recycler', 'manifest', 'status', 'pickup_proof', 'dropoff_proof', 'created_at', 'updated_at'],
    jsonb: ['manifest', 'pickup_proof', 'dropoff_proof'],
    fromRow: (r) => ({ _id: r.id, deliveryWorkerId: r.delivery_worker_id, pickupHub: r.pickup_hub, dropoffRecycler: r.dropoff_recycler, manifest: r.manifest, status: r.status, pickupProof: r.pickup_proof, dropoffProof: r.dropoff_proof, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) }),
    toRow: (r) => [r._id, nz(r.deliveryWorkerId), nz(r.pickupHub), nz(r.dropoffRecycler), JSON.stringify(arr(r.manifest)), r.status, JSON.stringify(r.pickupProof ?? {}), JSON.stringify(r.dropoffProof ?? {}), r.createdAt, r.updatedAt],
  },
  {
    name: 'disputes',
    array: disputes,
    columns: ['id', 'raised_by', 'against', 'inventory_id', 'type', 'description', 'evidence', 'status', 'created_at', 'updated_at'],
    jsonb: [],
    fromRow: (r) => ({ _id: r.id, raisedBy: r.raised_by, against: r.against, inventoryId: r.inventory_id, type: r.type, description: r.description, evidence: r.evidence, status: r.status, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) }),
    toRow: (r) => [r._id, nz(r.raisedBy), nz(r.against), nz(r.inventoryId), r.type, r.description, arr(r.evidence), r.status ?? 'open', r.createdAt, r.updatedAt],
  },
  {
    name: 'notifications',
    array: notifications,
    columns: ['id', 'user_id', 'title', 'message', 'type', 'related_id', 'read', 'created_at'],
    jsonb: [],
    fromRow: (r) => ({ _id: r.id, userId: r.user_id, title: r.title, message: r.message, type: r.type, relatedId: r.related_id, read: r.read, createdAt: iso(r.created_at) }),
    toRow: (r) => [r._id, nz(r.userId), r.title, r.message, r.type, nz(r.relatedId), r.read ?? false, r.createdAt],
  },
  {
    name: 'payments',
    array: payments,
    columns: ['id', 'inventory_id', 'recycler_id', 'collected_by', 'amount', 'method', 'note', 'status', 'created_at'],
    jsonb: [],
    fromRow: (r) => ({ _id: r.id, inventoryId: r.inventory_id, recyclerId: r.recycler_id, collectedBy: r.collected_by, amount: r.amount, method: r.method, note: r.note, status: r.status, createdAt: iso(r.created_at) }),
    toRow: (r) => [r._id, nz(r.inventoryId), nz(r.recyclerId), nz(r.collectedBy), r.amount, r.method, r.note, r.status, r.createdAt],
  },
  {
    name: 'rewards',
    array: rewards,
    columns: ['id', 'user_id', 'total_points', 'current_streak', 'badges', 'milestones', 'history', 'created_at', 'updated_at'],
    jsonb: ['badges', 'milestones', 'history'],
    fromRow: (r) => ({ _id: r.id, userId: r.user_id, totalPoints: r.total_points, currentStreak: r.current_streak, badges: r.badges, milestones: r.milestones, history: r.history, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) }),
    toRow: (r) => [r._id, nz(r.userId), r.totalPoints ?? 0, r.currentStreak ?? 0, JSON.stringify(arr(r.badges)), JSON.stringify(arr(r.milestones)), JSON.stringify(arr(r.history)), r.createdAt, r.updatedAt],
  },
  {
    name: 'recycler_requests',
    array: recyclerRequests,
    columns: ['id', 'recycler_id', 'category', 'quantity', 'unit', 'note', 'target_date', 'status', 'allocated_inventory', 'reviewed_by', 'review_note', 'created_at', 'updated_at'],
    jsonb: ['allocated_inventory'],
    fromRow: (r) => ({ _id: r.id, recyclerId: r.recycler_id, category: r.category, quantity: r.quantity, unit: r.unit, note: r.note, targetDate: r.target_date, status: r.status, allocatedInventory: r.allocated_inventory, reviewedBy: r.reviewed_by, reviewNote: r.review_note, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) }),
    toRow: (r) => [r._id, nz(r.recyclerId), r.category, r.quantity, r.unit ?? 'kg', r.note ?? null, r.targetDate ?? null, r.status ?? 'pending', JSON.stringify(arr(r.allocatedInventory)), nz(r.reviewedBy), r.reviewNote ?? null, r.createdAt, r.updatedAt],
  },
  {
    name: 'earnings_ledger',
    array: earningsLedger,
    columns: ['id', 'user_id', 'role', 'inventory_id', 'amount_rs', 'type', 'decided_by', 'note', 'created_at'],
    jsonb: [],
    fromRow: (r) => ({ _id: r.id, userId: r.user_id, role: r.role, inventoryId: r.inventory_id, amountRs: r.amount_rs, type: r.type, decidedBy: r.decided_by, note: r.note, createdAt: iso(r.created_at) }),
    toRow: (r) => [r._id, nz(r.userId), r.role, nz(r.inventoryId), r.amountRs, r.type, nz(r.decidedBy), r.note ?? null, r.createdAt],
  },
];

let hydrated = false;

/**
 * Apply additive, idempotent column migrations the running app depends on.
 * Kept inline (no schema.sql file read) so it works in the bundled prod build.
 * Must run before flushAll(), whose INSERT lists these columns.
 */
export async function ensureSchema() {
  // Run both ALTERs in one round-trip (one pooled connection) and never let a
  // failure here crash boot — the columns are idempotent and may already exist.
  try {
    await pool.query(
      'alter table inventory add column if not exists quality_rating integer;' +
        'alter table inventory add column if not exists technician_name text;' +
        'alter table inventory add column if not exists assessed_value numeric;' +
        'alter table inventory add column if not exists original_price numeric;' +
        `create table if not exists category_prices (
           category text primary key,
           current_value numeric not null,
           updated_by text references users(id),
           updated_at timestamptz default now()
         );` +
        `create table if not exists earnings_ledger (
           id text primary key,
           user_id text references users(id),
           role text,
           inventory_id text references inventory(id),
           amount_rs numeric not null,
           type text not null,
           decided_by text references users(id),
           note text,
           created_at timestamptz default now()
         );`,
    );
  } catch (e) {
    console.error('[pgStore] ensureSchema skipped:', e.message);
  }
}

/** Load all tables from Postgres into the in-memory model arrays. */
export async function hydrateAll() {
  for (const t of TABLES) {
    const { rows } = await pool.query(`select * from ${t.name}`);
    t.array.length = 0;
    for (const r of rows) t.array.push(t.fromRow(r));
  }
  hydrated = true;
  console.log(`[pgStore] hydrated from Postgres: ${TABLES.map((t) => `${t.name}=${t.array.length}`).join(' ')}`);
}

/**
 * Persist all in-memory arrays back to Postgres in one transaction.
 *
 * NON-DESTRUCTIVE: upserts (insert-or-update by primary key) and never deletes —
 * so rows added/edited directly in the DB are preserved, not wiped. (Previously
 * this did a full delete-all + re-insert, which clobbered any out-of-band DB edit.)
 *
 * Set DISABLE_FLUSH=1 in the environment to turn off all DB writes (full manual
 * control of the database; in-app changes then live only in memory until restart).
 */
export async function flushAll() {
  if (process.env.DISABLE_FLUSH === '1') return;
  // Safety: don't write if we haven't successfully hydrated yet.
  if (!hydrated) return;
  let client;
  let hadError = false;
  try {
    client = await pool.connect();
    // The Supabase pooler can drop a connection mid-flush. A checked-out client
    // emits 'error' for that; WITHOUT a listener Node turns it into an unhandled
    // exception and kills the whole server. This listener keeps us alive.
    client.on('error', (e) => {
      hadError = true;
      console.error('[pgStore] flush client error (ignored, changes kept in memory):', e.message);
    });
    await client.query('begin');
    for (const t of TABLES) {
      const pk = t.columns[0]; // first column is the PK ('id', or 'category' for category_prices)
      const cols = t.columns.join(', ');
      const ph = t.columns.map((c, i) => (t.jsonb.includes(c) ? `$${i + 1}::jsonb` : `$${i + 1}`)).join(', ');
      const setList = t.columns.filter((c) => c !== pk).map((c) => `${c}=excluded.${c}`).join(', ');
      const conflict = setList ? `do update set ${setList}` : 'do nothing';
      const sql = `insert into ${t.name} (${cols}) values (${ph}) on conflict (${pk}) ${conflict}`;
      for (const rec of t.array) await client.query(sql, t.toRow(rec));
    }
    await client.query('commit');
  } catch (e) {
    hadError = true;
    if (client) await client.query('rollback').catch(() => {});
    console.error('[pgStore] flush failed (changes kept in memory, retried on next write):', e.message);
  } finally {
    // Pass the error to release() so a broken connection is discarded, not reused.
    if (client) client.release(hadError || undefined);
  }
}

// Coalesced fire-and-forget flush so bursts of writes don't stack transactions.
let running = false;
let pending = false;
export function scheduleFlush() {
  if (running) {
    pending = true;
    return;
  }
  running = true;
  flushAll().finally(() => {
    running = false;
    if (pending) {
      pending = false;
      scheduleFlush();
    }
  });
}
