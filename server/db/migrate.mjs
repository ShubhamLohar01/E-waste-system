/**
 * One-time migration: create tables (schema.sql) and load server/data/*.json into Postgres.
 * Idempotent — re-running skips rows that already exist (ON CONFLICT DO NOTHING).
 *
 * Run from project root:  node server/db/migrate.mjs
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');

const load = (n) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${n}.json`), 'utf8'));
const nz = (v) => (v === '' || v === undefined ? null : v);          // '' / undefined -> null (FK safe)
const arr = (v) => (Array.isArray(v) ? v : []);                      // text[] safety

// table -> { columns, jsonb (cols needing ::jsonb cast), map(record) -> values[] }
const TABLES = [
  {
    name: 'users',
    columns: ['id', 'name', 'email', 'password', 'phone', 'role', 'trust_level', 'location', 'avatar_url', 'is_active', 'created_at', 'updated_at'],
    jsonb: ['location'],
    map: (r) => [r._id, r.name, r.email, r.password, r.phone ?? '', r.role, r.trustLevel ?? 'standard', JSON.stringify(r.location ?? {}), r.avatarUrl ?? null, r.isActive ?? true, r.createdAt, r.updatedAt],
  },
  {
    name: 'usr_req_items',
    file: 'intents',                 // historical data file kept the old name
    columns: ['id', 'user_id', 'username', 'type', 'items', 'status', 'assigned_collector', 'location', 'created_at', 'updated_at'],
    jsonb: ['items', 'location'],
    map: (r) => [r._id, nz(r.userId), r.username ?? null, r.type, JSON.stringify(arr(r.items)), r.status ?? 'submitted', nz(r.assignedCollector), JSON.stringify(r.location ?? {}), r.createdAt, r.updatedAt],
  },
  {
    name: 'demands',
    columns: ['id', 'recycler_id', 'category', 'quantity_needed', 'unit', 'delivery_window', 'status', 'matched_inventory', 'created_at', 'updated_at'],
    jsonb: ['delivery_window', 'matched_inventory'],
    map: (r) => [r._id, nz(r.recyclerId), r.category, r.quantityNeeded, r.unit, JSON.stringify(r.deliveryWindow ?? {}), r.status ?? 'open', JSON.stringify(arr(r.matchedInventory)), r.createdAt, r.updatedAt],
  },
  {
    name: 'inventory',
    columns: ['id', 'qr_code', 'intent_id', 'category', 'claimed_category', 'actual_qty', 'claimed_qty', 'unit', 'weight_kg', 'condition', 'status', 'source_user_id', 'collector_id', 'hub_id', 'delivery_worker_id', 'recycler_id', 'matched_demand_id', 'verification_photos', 'traceability', 'quality_rating', 'technician_name', 'created_at', 'updated_at'],
    jsonb: ['traceability'],
    map: (r) => [r._id, nz(r.qrCode), nz(r.intentId), r.category, r.claimedCategory, r.actualQty, r.claimedQty, r.unit, r.weightKg ?? null, r.condition, r.status, nz(r.sourceUserId), nz(r.collectorId), nz(r.hubId), nz(r.deliveryWorkerId), nz(r.recyclerId), nz(r.matchedDemandId), arr(r.verificationPhotos), JSON.stringify(arr(r.traceability)), r.qualityRating ?? null, r.technicianName ?? null, r.createdAt, r.updatedAt],
  },
  {
    name: 'deliveries',
    columns: ['id', 'delivery_worker_id', 'pickup_hub', 'dropoff_recycler', 'manifest', 'status', 'pickup_proof', 'dropoff_proof', 'created_at', 'updated_at'],
    jsonb: ['manifest', 'pickup_proof', 'dropoff_proof'],
    map: (r) => [r._id, nz(r.deliveryWorkerId), nz(r.pickupHub), nz(r.dropoffRecycler), JSON.stringify(arr(r.manifest)), r.status, JSON.stringify(r.pickupProof ?? {}), JSON.stringify(r.dropoffProof ?? {}), r.createdAt, r.updatedAt],
  },
  {
    name: 'disputes',
    columns: ['id', 'raised_by', 'against', 'inventory_id', 'type', 'description', 'evidence', 'status', 'created_at', 'updated_at'],
    jsonb: [],
    map: (r) => [r._id, nz(r.raisedBy), nz(r.against), nz(r.inventoryId), r.type, r.description, arr(r.evidence), r.status ?? 'open', r.createdAt, r.updatedAt],
  },
  {
    name: 'notifications',
    columns: ['id', 'user_id', 'title', 'message', 'type', 'related_id', 'read', 'created_at'],
    jsonb: [],
    map: (r) => [r._id, nz(r.userId), r.title, r.message, r.type, nz(r.relatedId), r.read ?? false, r.createdAt],
  },
  {
    name: 'payments',
    columns: ['id', 'inventory_id', 'recycler_id', 'collected_by', 'amount', 'method', 'note', 'status', 'created_at'],
    jsonb: [],
    map: (r) => [r._id, nz(r.inventoryId), nz(r.recyclerId), nz(r.collectedBy), r.amount, r.method, r.note, r.status, r.createdAt],
  },
  {
    name: 'rewards',
    columns: ['id', 'user_id', 'total_points', 'current_streak', 'badges', 'milestones', 'history', 'created_at', 'updated_at'],
    jsonb: ['badges', 'milestones', 'history'],
    map: (r) => [r._id, nz(r.userId), r.totalPoints ?? 0, r.currentStreak ?? 0, JSON.stringify(arr(r.badges)), JSON.stringify(arr(r.milestones)), JSON.stringify(arr(r.history)), r.createdAt, r.updatedAt],
  },
];

async function insertTable(client, cfg) {
  const records = load(cfg.file ?? cfg.name);
  const cols = cfg.columns.join(', ');
  const ph = cfg.columns.map((c, i) => (cfg.jsonb.includes(c) ? `$${i + 1}::jsonb` : `$${i + 1}`)).join(', ');
  const sql = `insert into ${cfg.name} (${cols}) values (${ph}) on conflict (id) do nothing`;
  let inserted = 0;
  for (const rec of records) {
    const res = await client.query(sql, cfg.map(rec));
    inserted += res.rowCount;
  }
  return { total: records.length, inserted };
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    console.log('→ Creating schema…');
    await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    console.log('  schema OK\n→ Loading data (FK-dependency order)…');

    for (const cfg of TABLES) {
      const { total, inserted } = await insertTable(client, cfg);
      const db = (await client.query(`select count(*)::int as n from ${cfg.name}`)).rows[0].n;
      console.log(`  ${cfg.name.padEnd(14)} json=${String(total).padStart(3)}  inserted=${String(inserted).padStart(3)}  db_total=${db}`);
    }
    console.log('\n✅ Migration complete.');
  } catch (e) {
    console.error('\n❌ Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
