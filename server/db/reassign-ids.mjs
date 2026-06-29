/**
 * One-time migration: re-assign every legacy record id to the readable,
 * role/type-prefixed, monthly-sequential format and rewrite ALL references.
 *
 *   users      -> HUB / RCY / COL / DEL / USR / BLK / ADM  (by role)
 *   inventory  -> ITEM   intents -> INT   demands -> DMD   deliveries -> DLV
 *   disputes   -> DSP    notifications -> NTF   payments -> PAY
 *   rewards    -> RWD    recycler_requests -> REQ
 *   format: <PREFIX>-<YYYYMM><seq3>  e.g. HUB-202606001
 *
 * Boxes are intentionally NOT renumbered — they already use BI-XXX0001 ids that
 * are baked into signed, printable QR stickers. Their references (inventoryId,
 * hubId, recyclerId) ARE rewritten so they keep pointing at the right records.
 *
 * QR tokens (inventory.qrCode, manifest.qrCode, box.qrPayload) are opaque signed
 * strings matched as whole values, so they're left untouched.
 *
 * Usage (from project root):
 *   node server/db/reassign-ids.mjs            # dry run — prints the plan, writes nothing
 *   node server/db/reassign-ids.mjs --apply    # takes a JSON backup, then writes
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../lib/db.js';
import { hydrateAll, flushAll } from '../lib/pgStore.js';
import { ROLE_PREFIX } from '../utils/idGenerator.js';
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
import { boxes } from '../models/Box.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

const idMap = new Map(); // oldId -> newId (global; ids are globally unique)
const seqByGroup = new Map(); // `${prefix}-${period}` -> last sequence used

function periodOf(createdAt) {
  const d = createdAt ? new Date(createdAt) : null;
  if (!d || isNaN(d.getTime())) return '000000'; // undated records grouped together
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function assign(prefix, rec) {
  const period = periodOf(rec.createdAt);
  const key = `${prefix}-${period}`;
  const n = (seqByGroup.get(key) || 0) + 1;
  seqByGroup.set(key, n);
  idMap.set(rec._id, `${prefix}-${period}${String(n).padStart(3, '0')}`);
}

const byCreated = (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0);

// Assign in chronological order so the earliest record in each group is …001.
function buildMap() {
  [...users].sort(byCreated).forEach((u) => assign(ROLE_PREFIX[u.role] || 'USR', u));
  [...intents].sort(byCreated).forEach((r) => assign('INT', r));
  [...inventory].sort(byCreated).forEach((r) => assign('ITEM', r));
  [...demands].sort(byCreated).forEach((r) => assign('DMD', r));
  [...deliveries].sort(byCreated).forEach((r) => assign('DLV', r));
  [...disputes].sort(byCreated).forEach((r) => assign('DSP', r));
  [...notifications].sort(byCreated).forEach((r) => assign('NTF', r));
  [...payments].sort(byCreated).forEach((r) => assign('PAY', r));
  [...rewards].sort(byCreated).forEach((r) => assign('RWD', r));
  [...recyclerRequests].sort(byCreated).forEach((r) => assign('REQ', r));
  // boxes intentionally excluded
}

const m = (v) => (v == null ? v : idMap.get(v) ?? v);
const mArr = (a) => (Array.isArray(a) ? a.map(m) : a);

function applyMap() {
  users.forEach((u) => { u._id = m(u._id); });

  intents.forEach((r) => {
    r._id = m(r._id);
    r.userId = m(r.userId);
    r.assignedCollector = m(r.assignedCollector);
  });

  inventory.forEach((r) => {
    r._id = m(r._id);
    r.intentId = m(r.intentId);
    r.sourceUserId = m(r.sourceUserId);
    r.collectorId = m(r.collectorId);
    r.hubId = m(r.hubId);
    r.deliveryWorkerId = m(r.deliveryWorkerId);
    r.recyclerId = m(r.recyclerId);
    r.matchedDemandId = m(r.matchedDemandId);
    if (Array.isArray(r.traceability)) {
      r.traceability.forEach((t) => { if (t && t.actor) t.actor = m(t.actor); });
    }
  });

  demands.forEach((r) => {
    r._id = m(r._id);
    r.recyclerId = m(r.recyclerId);
    r.matchedInventory = mArr(r.matchedInventory);
  });

  deliveries.forEach((r) => {
    r._id = m(r._id);
    r.deliveryWorkerId = m(r.deliveryWorkerId);
    r.pickupHub = m(r.pickupHub);
    r.dropoffRecycler = m(r.dropoffRecycler);
    if (Array.isArray(r.manifest)) {
      r.manifest.forEach((mf) => { if (mf && mf.inventoryId) mf.inventoryId = m(mf.inventoryId); });
    }
  });

  disputes.forEach((r) => {
    r._id = m(r._id);
    r.raisedBy = m(r.raisedBy);
    r.against = m(r.against);
    r.inventoryId = m(r.inventoryId);
  });

  notifications.forEach((r) => {
    r._id = m(r._id);
    r.userId = m(r.userId);
    r.relatedId = m(r.relatedId); // generic ref — remapped if it points at a renumbered record
  });

  payments.forEach((r) => {
    r._id = m(r._id);
    r.inventoryId = m(r.inventoryId);
    r.recyclerId = m(r.recyclerId);
    r.collectedBy = m(r.collectedBy);
  });

  rewards.forEach((r) => {
    r._id = m(r._id);
    r.userId = m(r.userId);
    if (Array.isArray(r.history)) {
      r.history.forEach((h) => { if (h && h.inventoryId) h.inventoryId = m(h.inventoryId); });
    }
  });

  recyclerRequests.forEach((r) => {
    r._id = m(r._id);
    r.recyclerId = m(r.recyclerId);
    r.reviewedBy = m(r.reviewedBy);
    r.allocatedInventory = mArr(r.allocatedInventory);
  });

  // boxes: keep _id / qrPayload / transactionNo; only fix references
  boxes.forEach((r) => {
    r.inventoryId = m(r.inventoryId);
    r.hubId = m(r.hubId);
    r.recyclerId = m(r.recyclerId);
  });
}

function backup() {
  const dir = path.join(__dirname, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `pre-reassign-${stamp}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      { users, intents, inventory, demands, deliveries, disputes, notifications, payments, rewards, recyclerRequests, boxes },
      null,
      2
    )
  );
  return file;
}

async function main() {
  console.log('→ Loading current data from Postgres…');
  await hydrateAll();

  console.log('  counts:', {
    users: users.length, intents: intents.length, inventory: inventory.length,
    demands: demands.length, deliveries: deliveries.length, disputes: disputes.length,
    notifications: notifications.length, payments: payments.length, rewards: rewards.length,
    recyclerRequests: recyclerRequests.length, boxes: boxes.length,
  });

  buildMap();

  console.log(`\n→ Planned id changes (${idMap.size} records re-numbered; ${boxes.length} boxes kept as-is):`);
  const entries = [...idMap.entries()];
  for (const [oldId, newId] of entries.slice(0, 15)) console.log(`   ${oldId}  →  ${newId}`);
  if (entries.length > 15) console.log(`   … and ${entries.length - 15} more`);

  const perPrefix = {};
  for (const newId of idMap.values()) {
    const p = newId.split('-')[0];
    perPrefix[p] = (perPrefix[p] || 0) + 1;
  }
  console.log('\n  new ids per prefix:', perPrefix);

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with  --apply  to write (a JSON backup is taken first).');
    await pool.end();
    return;
  }

  const file = backup();
  console.log(`\n✓ Backup of current (pre-migration) state: ${file}`);

  applyMap();
  console.log('→ Writing re-assigned ids back to Postgres…');
  await flushAll();

  console.log('\n✅ Done — all users now have role-based ids and every reference was rewritten.');
  console.log('   NOTE: existing login sessions hold OLD user ids, so everyone must log in again.');
  await pool.end();
}

main().catch(async (e) => {
  console.error('\n❌ reassign failed:', e);
  try { await pool.end(); } catch {}
  process.exitCode = 1;
});
