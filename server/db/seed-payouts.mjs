/**
 * Layer the new money-payout data onto the EXISTING demo dataset (non-destructive).
 *
 *  - Seeds category_prices (only categories not already priced).
 *  - For every item that reached the recycler (status delivered/processed):
 *      grade it by condition (if ungraded), value it via payoutEngine.recordSale
 *      (writes the 60/20/20 earnings_ledger entries + assessed_value), and for
 *      'delivered' items mark them processed + add a payment.
 *  - Adds a few hub→collector payments.
 *  - Sets a known password (Test@1234, bcrypt) on the top item's full role chain.
 *
 * Idempotent: recordSale skips already-valued items; prices skip existing rows.
 * Persists via pgStore.flushAll() — all demo data is preserved.
 *
 *   node server/db/seed-payouts.mjs
 */
import 'dotenv/config';
import { pool } from '../lib/db.js';
import { hydrateAll, flushAll } from '../lib/pgStore.js';
import { users } from '../models/User.js';
import { inventory } from '../models/Inventory.js';
import { payments } from '../models/Payment.js';
import { categoryPrices } from '../models/CategoryPrice.js';
import { earningsLedger } from '../models/EarningsLedger.js';
import { nextId, PREFIX } from '../utils/idGenerator.js';
import { hashPassword } from '../utils/helpers.js';
import { recordSale, recordCollectorPayment } from '../services/payoutEngine.js';

const PW = 'Test@1234';
const PRICES = {
  'Old Laptops': 12000,
  'Mobile Phones': 8000,
  Monitors: 4000,
  Printers: 3000,
  'Circuit Boards': 2000,
  'Electronic Cables': 800,
  'Keyboards & Mouse': 600,
  Batteries: 500,
};
const TECHS = ['Ramesh K.', 'Sana M.', 'Ravi P.', 'Anil D.', 'Pooja V.'];
const gradeForCondition = (c) => ({ excellent: 10, good: 8, fair: 5, damaged: 3 }[c] ?? 7);

async function main() {
  console.log('→ Loading current data…');
  await hydrateAll();
  const admin = users.find((u) => u.role === 'admin');
  if (!admin) throw new Error('No admin account found.');
  const now = new Date().toISOString();

  // 1) Price catalog (skip already-priced categories)
  let pricesAdded = 0;
  for (const [category, currentValue] of Object.entries(PRICES)) {
    if (!categoryPrices.find((c) => c.category === category)) {
      categoryPrices.push({ category, currentValue, updatedBy: admin._id, updatedAt: now });
      pricesAdded += 1;
    }
  }

  // 2) Value every item that reached the recycler
  const targets = inventory.filter((i) => ['delivered', 'processed'].includes(i.status));
  let valued = 0, paid = 0, collectorPays = 0, skipped = 0;
  targets.forEach((item, idx) => {
    if (item.qualityRating == null) {
      item.qualityRating = gradeForCondition(item.condition);
      item.technicianName = TECHS[idx % TECHS.length];
    }
    const sale = recordSale(item, admin._id); // sets assessedValue + writes ledger
    if (!sale.ok) { skipped += 1; return; }   // already valued, or no price
    valued += 1;

    if (item.status === 'delivered') {
      item.status = 'processed';
      item.processedAt = now;
      item.updatedAt = now;
      item.traceability = Array.isArray(item.traceability) ? item.traceability : [];
      item.traceability.push({ actor: admin._id, actorName: admin.name, action: 'payment_collected', note: `₹${sale.X}`, timestamp: now });
      payments.push({
        _id: nextId(PREFIX.PAYMENT),
        inventoryId: item._id,
        recyclerId: item.recyclerId,
        collectedBy: admin._id,
        amount: sale.X,
        method: 'bank_transfer',
        note: 'Payout (layered onto demo data)',
        status: 'collected',
        createdAt: now,
      });
      paid += 1;
    }

    // A hub→collector payment on roughly every 3rd item that has a collector
    if (item.collectorId && idx % 3 === 0) {
      recordCollectorPayment(item.collectorId, item._id, Math.max(50, Math.round(sale.X * 0.05)), item.hubId);
      collectorPays += 1;
    }
  });

  // 3) Known password on the top item's full role chain + admin
  const top = inventory
    .filter((i) => i.assessedValue != null)
    .sort((a, b) => (b.assessedValue || 0) - (a.assessedValue || 0))[0];
  const chainIds = top
    ? [top.sourceUserId, top.collectorId, top.hubId, top.recyclerId, top.deliveryWorkerId, admin._id].filter(Boolean)
    : [admin._id];
  const hash = await hashPassword(PW);
  const chainUsers = [];
  for (const id of chainIds) {
    const u = users.find((x) => x._id === id);
    if (u) { u.password = hash; u.updatedAt = now; chainUsers.push(u); }
  }

  console.log('→ Summary:', {
    pricesAdded,
    itemsValued: valued,
    markedProcessed: paid,
    collectorPayments: collectorPays,
    skippedAlreadyValued: skipped,
    ledgerRows: earningsLedger.length,
    ledgerTotalRs: earningsLedger.reduce((s, e) => s + Number(e.amountRs || 0), 0),
  });

  console.log('\n→ Persisting via flushAll()…');
  await flushAll();

  console.log(`\n✅ Done. Login chain (password "${PW}") for "${top?.category}" ₹${top?.assessedValue}:`);
  for (const u of chainUsers) console.log(`  ${u.role.padEnd(16)} ${String(u.email).padEnd(34)} ${u.name}`);
  await pool.end();
}

main().catch(async (e) => {
  console.error('❌ failed:', e);
  try { await pool.end(); } catch {}
  process.exitCode = 1;
});
