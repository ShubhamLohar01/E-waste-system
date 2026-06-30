/**
 * Sample-data generator — creates a realistic dataset by running records through
 * the app's OWN logic (role-based ids, QR signing, the payout engine) and persists
 * via pgStore.flushAll(). NOT static mock data.
 *
 *  - Keeps all existing users untouched (hydrated, then re-persisted as-is).
 *  - Seeds category_prices, then a spread of inventory across every lifecycle stage,
 *    including fully-paid items so earnings_ledger / payments / category prices populate.
 *  - Guarded: aborts if any inventory already exists, so it won't double-seed.
 *
 * Usage (from project root):  node server/db/seed-sample.mjs
 */
import 'dotenv/config';
import { pool } from '../lib/db.js';
import { hydrateAll, flushAll } from '../lib/pgStore.js';
import { users } from '../models/User.js';
import { intents } from '../models/Intent.js';
import { inventory } from '../models/Inventory.js';
import { deliveries } from '../models/Delivery.js';
import { payments } from '../models/Payment.js';
import { boxes } from '../models/Box.js';
import { categoryPrices } from '../models/CategoryPrice.js';
import { earningsLedger } from '../models/EarningsLedger.js';
import { nextId, PREFIX } from '../utils/idGenerator.js';
import { generateQRCode } from '../utils/helpers.js';
import { formatTransactionNo, makeBoxId, boxQrPayload } from '../utils/boxCodes.js';
import { recordSale, recordCollectorPayment } from '../services/payoutEngine.js';

const STAGES = ['submitted', 'assigned', 'collected', 'at_hub', 'verified', 'matched', 'in_transit', 'delivered', 'processed'];
const isoMinus = (days) => new Date(Date.now() - days * 86_400_000).toISOString();

// Current market value per category (base P for payouts).
const PRICES = {
  'Old Laptops': 12000,
  'Mobile Phones': 8000,
  Monitors: 4000,
  Printers: 3000,
  'Circuit Boards': 2000,
  Batteries: 500,
};

// One sample item per spec; `stage` decides how far down the chain it travels.
const SPECS = [
  { cat: 'Mobile Phones', qty: 2, stage: 'submitted', daysAgo: 1 },
  { cat: 'Batteries', qty: 5, stage: 'assigned', daysAgo: 2 },
  { cat: 'Old Laptops', qty: 1, weightKg: 3, stage: 'collected', daysAgo: 3 },
  { cat: 'Monitors', qty: 1, weightKg: 5, stage: 'at_hub', daysAgo: 4 },
  { cat: 'Printers', qty: 1, weightKg: 6, stage: 'verified', daysAgo: 5 },
  { cat: 'Old Laptops', qty: 1, weightKg: 2.5, stage: 'matched', daysAgo: 6 },
  { cat: 'Mobile Phones', qty: 3, weightKg: 1.2, stage: 'in_transit', daysAgo: 7 },
  { cat: 'Circuit Boards', qty: 4, weightKg: 2, stage: 'delivered', grade: 8, tech: 'Ramesh K.', daysAgo: 8 },
  { cat: 'Old Laptops', qty: 1, weightKg: 3, stage: 'processed', grade: 10, tech: 'Sana M.', daysAgo: 10, collectorPay: 200 },
  { cat: 'Mobile Phones', qty: 2, weightKg: 0.8, stage: 'processed', grade: 6, tech: 'Ravi P.', daysAgo: 12 },
];

async function main() {
  console.log('→ Loading users from Postgres…');
  await hydrateAll();

  if (inventory.length > 0) {
    console.log(`✋ Aborting: inventory already has ${inventory.length} rows. This seed only runs on an empty inventory.`);
    await pool.end();
    return;
  }

  const byRole = (r) => users.filter((u) => u.role === r);
  const su = byRole('small_user');
  const col = byRole('local_collector');
  const hub = byRole('hub');
  const rec = byRole('recycler');
  const dw = byRole('delivery_worker');
  const admin = byRole('admin')[0];
  for (const [name, arr] of [['small_user', su], ['local_collector', col], ['hub', hub], ['recycler', rec], ['delivery_worker', dw]]) {
    if (!arr.length) throw new Error(`No ${name} accounts found — cannot build the sample chain.`);
  }
  if (!admin) throw new Error('No admin account found — needed as the payout "decidedBy".');
  const at = (arr, i) => arr[i % arr.length];

  // 1) Price catalog
  const now = new Date().toISOString();
  for (const [category, currentValue] of Object.entries(PRICES)) {
    categoryPrices.push({ category, currentValue, updatedBy: admin._id, updatedAt: now });
  }

  let txnSeq = 0;
  SPECS.forEach((spec, idx) => {
    const reached = (s) => STAGES.indexOf(spec.stage) >= STAGES.indexOf(s);
    const ts = isoMinus(spec.daysAgo);
    const sUser = at(su, idx);
    const collector = at(col, idx);
    const theHub = at(hub, idx);
    const recycler = at(rec, idx);
    const worker = at(dw, idx);

    const invId = nextId(PREFIX.INVENTORY);
    const intentId = nextId(PREFIX.INTENT);
    const unit = spec.unit || 'pieces';

    // Intent
    intents.push({
      _id: intentId,
      userId: sUser._id,
      username: sUser.name,
      type: 'small_user',
      items: [{ category: spec.cat, estimatedQty: spec.qty, unit, photos: [], invoice: null, condition: 'good', purchaseDate: null }],
      status: reached('collected') ? 'collected' : reached('assigned') ? 'assigned' : 'submitted',
      assignedCollector: reached('assigned') ? collector._id : null,
      location: { lat: null, lng: null, address: sUser.location?.address || 'Pune, Maharashtra' },
      createdAt: ts,
      updatedAt: ts,
    });

    // Inventory + traceability chain
    const trace = [{ actor: sUser._id, actorName: sUser.name, action: 'submitted', timestamp: ts }];
    if (reached('collected')) trace.push({ actor: collector._id, actorName: collector.name, action: 'collected', timestamp: ts });
    if (reached('at_hub')) trace.push({ actor: collector._id, actorName: collector.name, action: 'delivered_to_hub', timestamp: ts });
    if (reached('verified')) trace.push({ actor: theHub._id, actorName: theHub.name, action: 'verified_at_hub', timestamp: ts });
    if (reached('matched')) trace.push({ actor: admin._id, actorName: admin.name, action: 'matched_to_recycler', timestamp: ts });
    if (reached('in_transit')) trace.push({ actor: worker._id, actorName: worker.name, action: 'picked_up_from_hub', timestamp: ts });
    if (reached('delivered')) trace.push({ actor: worker._id, actorName: worker.name, action: 'delivered_to_recycler', timestamp: ts });

    const invStatus = reached('processed') ? 'processed'
      : reached('delivered') ? 'delivered'
      : reached('in_transit') ? 'in_transit'
      : reached('matched') ? 'matched'
      : reached('verified') ? 'verified'
      : reached('at_hub') ? 'at_hub'
      : reached('collected') ? 'collected'
      : 'submitted';

    const inv = {
      _id: invId,
      qrCode: generateQRCode(invId),
      intentId,
      category: spec.cat,
      claimedCategory: spec.cat,
      actualQty: spec.qty,
      claimedQty: spec.qty,
      unit,
      weightKg: spec.weightKg ?? null,
      condition: 'good',
      status: invStatus,
      sourceUserId: sUser._id,
      collectorId: reached('collected') ? collector._id : null,
      hubId: reached('at_hub') ? theHub._id : null,
      deliveryWorkerId: reached('in_transit') ? worker._id : null,
      recyclerId: reached('matched') ? recycler._id : null,
      matchedDemandId: null,
      verificationPhotos: [],
      traceability: trace,
      qualityRating: reached('delivered') ? (spec.grade ?? 7) : null,
      technicianName: reached('delivered') ? (spec.tech ?? null) : null,
      assessedValue: null,
      originalPrice: reached('delivered') ? PRICES[spec.cat] * 1.5 : null,
      createdAt: ts,
      updatedAt: ts,
    };
    inventory.push(inv);

    // Boxes (one per item once verified)
    if (reached('verified')) {
      txnSeq += 1;
      const transactionNo = `${formatTransactionNo(new Date())}-${txnSeq}`;
      const prefix = `S${String(idx).padStart(2, '0')}`.toUpperCase().slice(0, 3);
      const boxId = makeBoxId(prefix, 1);
      const acked = reached('delivered');
      boxes.push({
        _id: boxId,
        transactionNo,
        inventoryId: invId,
        qrPayload: boxQrPayload(transactionNo, boxId),
        itemName: spec.cat,
        netWeightKg: spec.weightKg ?? null,
        unit,
        boxSeq: 1,
        boxCount: 1,
        hubId: theHub._id,
        hubName: theHub.name,
        status: acked ? 'acknowledged' : 'printed',
        recyclerId: acked ? recycler._id : null,
        recyclerCompany: acked ? recycler.name : null,
        acknowledgedAt: acked ? ts : null,
        createdAt: ts,
        updatedAt: ts,
      });
    }

    // Delivery record (once a worker is carrying it)
    if (reached('in_transit')) {
      deliveries.push({
        _id: nextId(PREFIX.DELIVERY),
        deliveryWorkerId: worker._id,
        pickupHub: theHub._id,
        dropoffRecycler: recycler._id,
        manifest: [{ inventoryId: invId, qrCode: inv.qrCode, category: spec.cat, qty: spec.qty, unit, weightKg: spec.weightKg ?? null }],
        status: reached('delivered') ? 'delivered' : 'picked_up',
        pickupProof: { qrScanned: true, scannedCount: 1, timestamp: ts },
        dropoffProof: reached('delivered') ? { qrScanned: true, scannedCount: 1, timestamp: ts } : { qrScanned: false },
        createdAt: ts,
        updatedAt: ts,
      });
    }

    // Payout (processed): value via the real engine, then record payment.
    if (reached('processed')) {
      const sale = recordSale(inv, admin._id); // writes user/platform/hub ledger entries + sets assessedValue
      if (!sale.ok) throw new Error(`recordSale failed for ${spec.cat}: ${sale.error}`);
      payments.push({
        _id: nextId(PREFIX.PAYMENT),
        inventoryId: invId,
        recyclerId: recycler._id,
        collectedBy: admin._id,
        amount: sale.X,
        method: 'bank_transfer',
        note: 'Sample payout',
        status: 'collected',
        createdAt: ts,
      });
      if (spec.collectorPay) {
        recordCollectorPayment(collector._id, invId, spec.collectorPay, theHub._id);
      }
    }
  });

  console.log('→ Built in memory:', {
    categoryPrices: categoryPrices.length,
    intents: intents.length,
    inventory: inventory.length,
    deliveries: deliveries.length,
    payments: payments.length,
    boxes: boxes.length,
    earningsLedger: earningsLedger.length,
  });

  console.log('→ Persisting via pgStore.flushAll()…');
  await flushAll();
  console.log('✅ Sample data written. Users untouched.');
  await pool.end();
}

main().catch(async (e) => {
  console.error('❌ seed failed:', e);
  try { await pool.end(); } catch {}
  process.exitCode = 1;
});
