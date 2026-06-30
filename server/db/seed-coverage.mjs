/**
 * Coverage seed — ensures EVERY hub, recycler, and small user has 2-3 entries.
 * Round-robins items across all of them, with varied lifecycle stages and payouts.
 * Additive + non-destructive (uses the upsert flushAll); existing data is kept.
 *
 *   node server/db/seed-coverage.mjs
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
import { recordSale } from '../services/payoutEngine.js';

const STAGES = ['submitted', 'collected', 'at_hub', 'verified', 'matched', 'in_transit', 'delivered', 'processed'];
const isoMinus = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
const PRICES = {
  'Old Laptops': 12000, 'Mobile Phones': 8000, Monitors: 4000, Printers: 3000,
  'Circuit Boards': 2000, 'Electronic Cables': 800, 'Keyboards & Mouse': 600, Batteries: 500,
};
const CATEGORIES = Object.keys(PRICES);
const TECHS = ['Ramesh K.', 'Sana M.', 'Ravi P.', 'Anil D.', 'Pooja V.'];

async function main() {
  console.log('→ Loading current data…');
  await hydrateAll();
  const byRole = (r) => users.filter((u) => u.role === r);
  const su = byRole('small_user'), col = byRole('local_collector'), hub = byRole('hub'),
    rec = byRole('recycler'), dw = byRole('delivery_worker');
  const admin = byRole('admin')[0];
  for (const [n, a] of [['small_user', su], ['local_collector', col], ['hub', hub], ['recycler', rec], ['delivery_worker', dw]])
    if (!a.length) throw new Error(`No ${n} accounts.`);
  if (!admin) throw new Error('No admin.');

  const now = new Date().toISOString();
  for (const [c, v] of Object.entries(PRICES))
    if (!categoryPrices.find((p) => p.category === c))
      categoryPrices.push({ category: c, currentValue: v, updatedBy: admin._id, updatedAt: now });

  const at = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
  let made = 0, txn = 0;

  function makeItem({ sUser, collector, theHub, recycler, worker, category, stage, grade, daysAgo }) {
    const reached = (s) => STAGES.indexOf(stage) >= STAGES.indexOf(s);
    const ts = isoMinus(daysAgo);
    const invId = nextId(PREFIX.INVENTORY), intentId = nextId(PREFIX.INTENT);
    const qty = 1 + (made % 4);
    const weightKg = Number((0.8 + (made % 6) * 0.6).toFixed(1));
    made += 1;

    intents.push({
      _id: intentId, userId: sUser._id, username: sUser.name, type: 'small_user',
      items: [{ category, estimatedQty: qty, unit: 'pieces', photos: [], invoice: null, condition: 'good', purchaseDate: null }],
      status: reached('collected') ? 'collected' : reached('assigned') ? 'assigned' : 'submitted',
      assignedCollector: reached('collected') ? collector._id : null,
      location: { lat: null, lng: null, address: sUser.location?.address || 'Maharashtra' },
      createdAt: ts, updatedAt: ts,
    });

    const trace = [{ actor: sUser._id, actorName: sUser.name, action: 'submitted', timestamp: ts }];
    if (reached('collected')) trace.push({ actor: collector._id, actorName: collector.name, action: 'collected', timestamp: ts });
    if (reached('at_hub')) trace.push({ actor: collector._id, actorName: collector.name, action: 'delivered_to_hub', timestamp: ts });
    if (reached('verified')) trace.push({ actor: theHub._id, actorName: theHub.name, action: 'verified_at_hub', timestamp: ts });
    if (reached('matched')) trace.push({ actor: admin._id, actorName: admin.name, action: 'matched_to_recycler', timestamp: ts });
    if (reached('in_transit')) trace.push({ actor: worker._id, actorName: worker.name, action: 'picked_up_from_hub', timestamp: ts });
    if (reached('delivered')) trace.push({ actor: worker._id, actorName: worker.name, action: 'delivered_to_recycler', timestamp: ts });

    const status = reached('processed') ? 'processed' : reached('delivered') ? 'delivered'
      : reached('in_transit') ? 'in_transit' : reached('matched') ? 'matched'
      : reached('verified') ? 'verified' : reached('at_hub') ? 'at_hub'
      : reached('collected') ? 'collected' : 'submitted';

    const inv = {
      _id: invId, qrCode: generateQRCode(invId), intentId, category, claimedCategory: category,
      actualQty: qty, claimedQty: qty, unit: 'pieces', weightKg, condition: 'good', status,
      sourceUserId: sUser._id,
      collectorId: reached('collected') ? collector._id : null,
      hubId: reached('at_hub') ? theHub._id : null,
      deliveryWorkerId: reached('in_transit') ? worker._id : null,
      recyclerId: reached('matched') ? recycler._id : null,
      matchedDemandId: null, verificationPhotos: [], traceability: trace,
      qualityRating: reached('delivered') ? grade : null,
      technicianName: reached('delivered') ? at(TECHS, made) : null,
      assessedValue: null, originalPrice: reached('delivered') ? PRICES[category] * 1.5 : null,
      createdAt: ts, updatedAt: ts,
    };
    inventory.push(inv);

    if (reached('verified')) {
      txn += 1;
      const transactionNo = `${formatTransactionNo(new Date())}-${txn}`;
      const prefix = `C${String(txn).padStart(2, '0')}`.toUpperCase().slice(0, 3);
      const boxId = makeBoxId(prefix, 1);
      const acked = reached('delivered');
      boxes.push({
        _id: boxId, transactionNo, inventoryId: invId, qrPayload: boxQrPayload(transactionNo, boxId),
        itemName: category, netWeightKg: weightKg, unit: 'pieces', boxSeq: 1, boxCount: 1,
        hubId: theHub._id, hubName: theHub.name, status: acked ? 'acknowledged' : 'printed',
        recyclerId: acked ? recycler._id : null, recyclerCompany: acked ? recycler.name : null,
        acknowledgedAt: acked ? ts : null, createdAt: ts, updatedAt: ts,
      });
    }
    if (reached('in_transit')) {
      deliveries.push({
        _id: nextId(PREFIX.DELIVERY), deliveryWorkerId: worker._id, pickupHub: theHub._id, dropoffRecycler: recycler._id,
        manifest: [{ inventoryId: invId, qrCode: inv.qrCode, category, qty, unit: 'pieces', weightKg }],
        status: reached('delivered') ? 'delivered' : 'picked_up',
        pickupProof: { qrScanned: true, scannedCount: 1, timestamp: ts },
        dropoffProof: reached('delivered') ? { qrScanned: true, scannedCount: 1, timestamp: ts } : { qrScanned: false },
        createdAt: ts, updatedAt: ts,
      });
    }
    if (reached('processed')) {
      const sale = recordSale(inv, admin._id);
      if (sale.ok) {
        inv.status = 'processed'; inv.processedAt = ts;
        payments.push({
          _id: nextId(PREFIX.PAYMENT), inventoryId: invId, recyclerId: recycler._id, collectedBy: admin._id,
          amount: sale.X, method: 'bank_transfer', note: 'Coverage seed', status: 'collected', createdAt: ts,
        });
      }
    }
  }

  // 2 items per recycler (covers all 19 recyclers), round-robin everything else.
  const recyclerStages = ['processed', 'processed', 'delivered', 'in_transit', 'matched'];
  let i = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let r = 0; r < rec.length; r++) {
      makeItem({
        sUser: at(su, i), collector: at(col, i), theHub: at(hub, i), recycler: rec[r], worker: at(dw, i),
        category: at(CATEGORIES, i), stage: recyclerStages[(r + pass) % recyclerStages.length],
        grade: 6 + ((r + pass) % 5), daysAgo: 2 + (i % 20),
      });
      i += 1;
    }
  }
  // A few early-stage items so collectors/hubs have pending work too.
  for (let u = 0; u < 8; u++) {
    makeItem({
      sUser: at(su, u + 3), collector: at(col, u), theHub: at(hub, u), recycler: at(rec, u), worker: at(dw, u),
      category: at(CATEGORIES, u), stage: ['submitted', 'collected', 'at_hub', 'verified'][u % 4], grade: 8, daysAgo: 1,
    });
  }

  console.log('→ Built:', {
    intents: intents.length, inventory: inventory.length, earningsLedger: earningsLedger.length,
    payments: payments.length, deliveries: deliveries.length, boxes: boxes.length, categoryPrices: categoryPrices.length,
  });
  console.log('→ Persisting (non-destructive flush)…');
  await flushAll();
  console.log('✅ Coverage seed written.');
  await pool.end();
}

main().catch(async (e) => { console.error('❌ failed:', e); try { await pool.end(); } catch {} process.exitCode = 1; });
