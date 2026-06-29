# Monetary Payout & Valuation System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace gamification points with a real-money payout: an admin price catalog × the technician's quality grade values each item, the pool is split 60/20/20 (user/platform/hub), and the hub records collector payments into a rupee ledger.

**Architecture:** A pure `payoutEngine` service (grade→%, split math, ledger writes) backed by two new in-memory+Postgres tables (`category_prices`, `earnings_ledger`) and two additive `inventory` columns. The admin `mark-payment` route computes the pool deterministically and writes ledger entries instead of awarding points. New read endpoints surface balances; the old reward engine/routes and delivery `earnings` endpoint are removed. UI on the admin, small-user, hub, collector, and delivery dashboards is updated to show money.

**Tech Stack:** Node.js + Express 5 (ESM), PostgreSQL via `pg` (write-through `pgStore`), Zod validation, Vitest for unit tests, React 18 + Vite + Tailwind on the client.

**Spec:** `docs/superpowers/specs/2026-06-29-monetary-payout-system-design.md`

**Conventions to follow:**
- Models are plain in-memory arrays (`export const x = []`) hydrated from Postgres at boot; routes mutate them and a middleware flushes back. Records use `_id` + camelCase; columns are snake_case mapped in `pgStore.js`.
- Additive schema is applied at boot by `ensureSchema()` in `pgStore.js` (inline DDL, no file reads).
- Run a single test file: `npx vitest run <path>`. Run all: `npm test`. Build everything: `npm run build`.

---

## File Structure

**Create**
- `server/models/CategoryPrice.js` — in-memory array for the price catalog.
- `server/models/EarningsLedger.js` — in-memory array for ledger entries.
- `server/services/payoutEngine.js` — grade%, split, computePool, recordSale, recordCollectorPayment, balance/ledger helpers.
- `server/services/payoutEngine.test.js` — unit tests for the pure logic.
- `server/routes/earnings.js` — `GET /api/earnings/mine`.

**Modify**
- `server/utils/idGenerator.js` — add `PREFIX.LEDGER` + collection.
- `server/lib/pgStore.js` — register both tables; extend inventory mapping; extend `ensureSchema()`.
- `server/db/schema.sql` — document the two new tables + columns (runtime applied by ensureSchema).
- `server/schemas.js` — `categoryPriceSchema`, `collectorPaymentSchema`; trim `markPaymentSchema`.
- `server/routes/admin.js` — category-price endpoints; rewrite `mark-payment` to use `payoutEngine`.
- `server/routes/hub.js` — `POST /api/hub/collector-payment`.
- `server/routes/intent.js` — remove `GET /api/intent/rewards`.
- `server/routes/delivery.js` — remove `GET /api/delivery/earnings`.
- `server/index.js` — register `earnings` route; unregister `rewards` route.
- `client/pages/dashboards/AdminDashboard.jsx` — price-catalog panel; payment dialog shows computed pool.
- `client/pages/dashboards/SmallUserDashboard.jsx` — earnings view replaces rewards section.
- `client/pages/RewardWallet.jsx` — repurpose to a money wallet (uses `/api/earnings/mine`).
- `client/pages/dashboards/HubDashboard.jsx` — hub earnings + "Record collector payment" action.
- `client/pages/dashboards/LocalCollectorDashboard.jsx` — collector earnings view.
- `client/pages/dashboards/DeliveryWorkerDashboard.jsx` — remove earnings UI.

**Delete (after refs removed)**
- `server/services/rewardEngine.js`, `server/routes/rewards.js`.

---

# PHASE 1 — Price catalog

### Task 1: CategoryPrice model + schema

**Files:**
- Create: `server/models/CategoryPrice.js`
- Modify: `server/schemas.js`
- Test: `server/schemas.test.js`

- [ ] **Step 1: Create the model**

`server/models/CategoryPrice.js`:
```js
// Filled from Postgres at boot by pgStore.hydrateAll(); mutated in place by routes.
export const categoryPrices = [];
```

- [ ] **Step 2: Write the failing schema test**

Append to `server/schemas.test.js`:
```js
import { categoryPriceSchema } from './schemas.js';

describe('categoryPriceSchema', () => {
  it('accepts a valid category price', () => {
    const r = categoryPriceSchema.safeParse({ category: 'Mobile Phones', currentValue: 1000 });
    expect(r.success).toBe(true);
  });
  it('rejects a negative price', () => {
    const r = categoryPriceSchema.safeParse({ category: 'Mobile Phones', currentValue: -5 });
    expect(r.success).toBe(false);
  });
  it('rejects an empty category', () => {
    const r = categoryPriceSchema.safeParse({ category: '', currentValue: 10 });
    expect(r.success).toBe(false);
  });
});
```
(If `describe/it/expect` are not already imported in this file, add `import { describe, it, expect } from 'vitest';` at the top — match the existing imports in the file.)

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run server/schemas.test.js`
Expected: FAIL — `categoryPriceSchema` is not exported.

- [ ] **Step 4: Add the schemas**

In `server/schemas.js`, add before `export function validate`:
```js
export const categoryPriceSchema = z.object({
  category: z.string().min(1).max(100),
  currentValue: z.number().nonnegative().max(100_000_000),
});

export const collectorPaymentSchema = z.object({
  inventoryId: z.string().min(1),
  amountRs: z.number().positive().max(10_000_000),
});
```

- [ ] **Step 5: Run it to confirm it passes**

Run: `npx vitest run server/schemas.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/models/CategoryPrice.js server/schemas.js server/schemas.test.js
git commit -m "feat: category price model + validation schemas"
```

---

### Task 2: Wire category_prices into pgStore + ensureSchema

**Files:**
- Modify: `server/lib/pgStore.js`
- Modify: `server/db/schema.sql`

- [ ] **Step 1: Import the model**

In `server/lib/pgStore.js`, add with the other model imports (near the top):
```js
import { categoryPrices } from '../models/CategoryPrice.js';
```

- [ ] **Step 2: Register the table**

In `pgStore.js`, add this entry to the `TABLES` array **immediately after the `users` entry** (it FK-references users):
```js
  {
    name: 'category_prices',
    array: categoryPrices,
    columns: ['category', 'current_value', 'updated_by', 'updated_at'],
    jsonb: [],
    fromRow: (r) => ({ category: r.category, currentValue: r.current_value, updatedBy: r.updated_by, updatedAt: iso(r.updated_at) }),
    toRow: (r) => [r.category, r.currentValue, nz(r.updatedBy), r.updatedAt],
  },
```

- [ ] **Step 3: Create the table at boot**

In `ensureSchema()` in `pgStore.js`, add to the `stmts` array:
```js
    `create table if not exists category_prices (
       category text primary key,
       current_value numeric not null,
       updated_by text references users(id),
       updated_at timestamptz default now()
     )`,
```

- [ ] **Step 4: Document it in schema.sql**

Append to `server/db/schema.sql`:
```sql
-- 12. category_prices (admin-maintained current market value per category) -----
create table if not exists category_prices (
  category      text primary key,
  current_value numeric not null,
  updated_by    text references users(id),
  updated_at    timestamptz default now()
);
```

- [ ] **Step 5: Build to confirm wiring compiles**

Run: `npm run build:server`
Expected: `✓ built` with no errors.

- [ ] **Step 6: Commit**

```bash
git add server/lib/pgStore.js server/db/schema.sql
git commit -m "feat: persist category_prices table"
```

---

### Task 3: Admin category-price endpoints

**Files:**
- Modify: `server/routes/admin.js`

- [ ] **Step 1: Add imports**

In `server/routes/admin.js`, add to the existing imports:
```js
import { categoryPrices } from '../models/CategoryPrice.js';
import { categoryPriceSchema } from '../schemas.js';
```
(The file already imports `validate` and others from `../schemas.js`; either extend that line or add a separate import — keep it valid.)

- [ ] **Step 2: Add the GET + PUT routes**

In `server/routes/admin.js`, add (near the other admin routes, before `export default router`):
```js
/**
 * GET /api/admin/category-prices — current market value per category.
 */
router.get('/category-prices', verifyAuth, requireRole('admin'), (req, res) => {
  try {
    const list = [...categoryPrices].sort((a, b) => a.category.localeCompare(b.category));
    res.json({ prices: list, total: list.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/category-prices — upsert one category's current value.
 */
router.put('/category-prices', verifyAuth, requireRole('admin'), validate(categoryPriceSchema), (req, res) => {
  try {
    const { category, currentValue } = req.body;
    const now = new Date().toISOString();
    let row = categoryPrices.find((c) => c.category === category);
    if (row) {
      row.currentValue = currentValue;
      row.updatedBy = req.user.id;
      row.updatedAt = now;
    } else {
      row = { category, currentValue, updatedBy: req.user.id, updatedAt: now };
      categoryPrices.push(row);
    }
    res.json({ message: 'Price saved', price: row });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 3: Build to confirm it compiles**

Run: `npm run build:server`
Expected: `✓ built`.

- [ ] **Step 4: Manual smoke test**

Start dev (`npm run dev`), log in as admin, then in the browser console or a REST client:
```
PUT /api/admin/category-prices  { "category": "Mobile Phones", "currentValue": 1000 }
GET /api/admin/category-prices
```
Expected: PUT returns the saved row; GET lists it.

- [ ] **Step 5: Commit**

```bash
git add server/routes/admin.js
git commit -m "feat: admin category-price catalog API"
```

---

### Task 4: Admin price-catalog UI

**Files:**
- Modify: `client/pages/dashboards/AdminDashboard.jsx`

- [ ] **Step 1: Add state + fetch + save handler**

In `AdminDashboard.jsx`, add state alongside the other `useState` hooks:
```jsx
const [catPrices, setCatPrices] = useState([]);
const [priceEdits, setPriceEdits] = useState({}); // category -> string value
```

Add a fetch (call it from the dashboard's existing data-refresh effect, mirroring how other admin lists are fetched in this file):
```jsx
const fetchCategoryPrices = useCallback(async () => {
  try {
    const res = await api.get('/api/admin/category-prices');
    setCatPrices(res?.prices || []);
  } catch (err) { console.error(err); }
}, []);
```
Call `fetchCategoryPrices()` wherever the dashboard loads its other data (the existing `useEffect`/refresh). Use the same `api` helper already imported in this file (`@/lib/api`); if it isn't imported yet, add `import { api } from '@/lib/api';`.

Add the save handler:
```jsx
const saveCategoryPrice = async (category) => {
  const raw = priceEdits[category];
  const currentValue = Number(raw);
  if (!Number.isFinite(currentValue) || currentValue < 0) return alert('Enter a valid amount (₹).');
  try {
    await api.put('/api/admin/category-prices', { category, currentValue });
    await fetchCategoryPrices();
  } catch (err) { alert(err?.message || 'Could not save price.'); }
};
```

- [ ] **Step 2: Add the panel JSX**

Add a section in the admin dashboard body (place it near other management sections). Use the same category list the app uses elsewhere; here we render existing catalog rows plus a free-text add row:
```jsx
<section className="rounded-lg border border-border bg-card p-5">
  <h2 className="text-lg font-bold mb-1">Category price catalog</h2>
  <p className="text-sm text-muted-foreground mb-4">
    Current market value (₹) per category. Payouts = this value × the technician's quality grade.
  </p>
  <div className="space-y-2">
    {catPrices.map((p) => (
      <div key={p.category} className="flex items-center gap-3">
        <span className="flex-1 text-sm font-medium">{p.category}</span>
        <input
          type="number"
          min="0"
          defaultValue={p.currentValue}
          onChange={(e) => setPriceEdits((s) => ({ ...s, [p.category]: e.target.value }))}
          className="w-40 px-3 py-2 rounded-lg border border-border bg-background text-sm"
        />
        <Button size="sm" variant="outline" onClick={() => saveCategoryPrice(p.category)}>Save</Button>
      </div>
    ))}
  </div>
  <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
    <input
      placeholder="New category name"
      onChange={(e) => setPriceEdits((s) => ({ ...s, __new_cat: e.target.value }))}
      className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
    />
    <input
      type="number" min="0" placeholder="₹ value"
      onChange={(e) => setPriceEdits((s) => ({ ...s, __new_val: e.target.value }))}
      className="w-40 px-3 py-2 rounded-lg border border-border bg-background text-sm"
    />
    <Button
      size="sm"
      onClick={async () => {
        const category = (priceEdits.__new_cat || '').trim();
        const currentValue = Number(priceEdits.__new_val);
        if (!category || !Number.isFinite(currentValue) || currentValue < 0) return alert('Enter a category and a valid ₹ value.');
        try { await api.put('/api/admin/category-prices', { category, currentValue }); await fetchCategoryPrices(); }
        catch (err) { alert(err?.message || 'Could not add.'); }
      }}
    >
      Add
    </Button>
  </div>
</section>
```
(`Button` is already imported in this file. If `useCallback` isn't imported, add it to the `react` import.)

- [ ] **Step 3: Build the client**

Run: `npm run build:client`
Expected: `✓ built`.

- [ ] **Step 4: Manual check**

Dev server, admin dashboard: add a category + value, reload — it persists.

- [ ] **Step 5: Commit**

```bash
git add client/pages/dashboards/AdminDashboard.jsx
git commit -m "feat: admin price-catalog management UI"
```

---

# PHASE 2 — Valuation, ledger & split

### Task 5: EarningsLedger model + LEDGER id prefix

**Files:**
- Create: `server/models/EarningsLedger.js`
- Modify: `server/utils/idGenerator.js`

- [ ] **Step 1: Create the model**

`server/models/EarningsLedger.js`:
```js
// Filled from Postgres at boot by pgStore.hydrateAll(); mutated in place by routes/services.
export const earningsLedger = [];
```

- [ ] **Step 2: Register the id prefix + collection**

In `server/utils/idGenerator.js`:
- Add the import with the other model imports:
```js
import { earningsLedger } from '../models/EarningsLedger.js';
```
- Add to the `COLLECTIONS` map (under the entity prefixes):
```js
  LE: () => earningsLedger,
```
- Add to the `PREFIX` object:
```js
  LEDGER: 'LE',
```

- [ ] **Step 3: Build to confirm it compiles**

Run: `npm run build:server`
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add server/models/EarningsLedger.js server/utils/idGenerator.js
git commit -m "feat: earnings ledger model + LE id prefix"
```

---

### Task 6: payoutEngine — pure valuation & split logic (TDD)

**Files:**
- Create: `server/services/payoutEngine.js`
- Test: `server/services/payoutEngine.test.js`

- [ ] **Step 1: Write the failing tests**

`server/services/payoutEngine.test.js`:
```js
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
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run server/services/payoutEngine.test.js`
Expected: FAIL — `payoutEngine.js` does not exist.

- [ ] **Step 3: Implement the engine**

`server/services/payoutEngine.js`:
```js
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
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run server/services/payoutEngine.test.js`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add server/services/payoutEngine.js server/services/payoutEngine.test.js
git commit -m "feat: payout engine (valuation, 60/20/20 split, ledger)"
```

---

### Task 7: Persist earnings_ledger + inventory value columns

**Files:**
- Modify: `server/lib/pgStore.js`
- Modify: `server/db/schema.sql`

- [ ] **Step 1: Import the model**

In `server/lib/pgStore.js`, add with the other imports:
```js
import { earningsLedger } from '../models/EarningsLedger.js';
```

- [ ] **Step 2: Extend the inventory mapping**

In the `inventory` entry of `TABLES`, add `'assessed_value', 'original_price'` to `columns` (immediately before `'created_at'`), and add the mappings:
- In `fromRow`, add: `assessedValue: r.assessed_value, originalPrice: r.original_price,`
- In `toRow`, add (in the same column position, before `r.createdAt`): `r.assessedValue ?? null, r.originalPrice ?? null,`

- [ ] **Step 3: Register the earnings_ledger table**

Add as the **last** entry of `TABLES` (it FK-references users + inventory):
```js
  {
    name: 'earnings_ledger',
    array: earningsLedger,
    columns: ['id', 'user_id', 'role', 'inventory_id', 'amount_rs', 'type', 'decided_by', 'note', 'created_at'],
    jsonb: [],
    fromRow: (r) => ({ _id: r.id, userId: r.user_id, role: r.role, inventoryId: r.inventory_id, amountRs: r.amount_rs, type: r.type, decidedBy: r.decided_by, note: r.note, createdAt: iso(r.created_at) }),
    toRow: (r) => [r._id, nz(r.userId), r.role, nz(r.inventoryId), r.amountRs, r.type, nz(r.decidedBy), r.note ?? null, r.createdAt],
  },
```

- [ ] **Step 4: Extend ensureSchema**

Add to the `stmts` array in `ensureSchema()`:
```js
    'alter table inventory add column if not exists assessed_value numeric',
    'alter table inventory add column if not exists original_price numeric',
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
     )`,
```

- [ ] **Step 5: Document in schema.sql**

Append to `server/db/schema.sql`:
```sql
-- 13. earnings_ledger (money payouts; replaces gamification points) -----------
create table if not exists earnings_ledger (
  id           text primary key,
  user_id      text references users(id),
  role         text,
  inventory_id text references inventory(id),
  amount_rs    numeric not null,
  type         text not null,            -- user_share | hub_share | platform_share | collector_payment
  decided_by   text references users(id),
  note         text,
  created_at   timestamptz default now()
);
create index if not exists idx_earnings_user      on earnings_ledger(user_id);
create index if not exists idx_earnings_inventory  on earnings_ledger(inventory_id);

alter table inventory add column if not exists assessed_value numeric;
alter table inventory add column if not exists original_price numeric;
```

- [ ] **Step 6: Build**

Run: `npm run build:server`
Expected: `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add server/lib/pgStore.js server/db/schema.sql
git commit -m "feat: persist earnings_ledger + inventory value columns"
```

---

### Task 8: Rewrite admin mark-payment to use the payout engine

**Files:**
- Modify: `server/schemas.js`
- Modify: `server/routes/admin.js`

- [ ] **Step 1: Trim markPaymentSchema (amount is now system-computed)**

Replace `markPaymentSchema` in `server/schemas.js` with:
```js
export const markPaymentSchema = z.object({
  inventoryId: z.string().min(1),
  method: z.enum(['bank_transfer', 'upi', 'cash', 'cheque']).optional(),
  note: z.string().max(500).optional(),
});
```

- [ ] **Step 2: Swap the engine import in admin.js**

In `server/routes/admin.js`, remove the `RewardEngine` import and add:
```js
import { recordSale } from '../services/payoutEngine.js';
```
(Find and delete `import { RewardEngine } from '../services/rewardEngine.js';` — or whatever its exact form is in this file.)

- [ ] **Step 3: Rewrite the mark-payment handler body**

Replace the body of `POST /api/admin/mark-payment` (the route at `server/routes/admin.js:364`) with:
```js
router.post('/mark-payment', verifyAuth, requireRole('admin'), validate(markPaymentSchema), (req, res) => {
  try {
    const { inventoryId, method = 'cash', note = '' } = req.body;
    const item = inventory.find((i) => i._id === inventoryId);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    if (item.status !== 'delivered') {
      return res.status(409).json({ error: `Item must be in status 'delivered' to collect payment. Current: ${item.status}` });
    }

    // Value the item and write the 60/20/20 ledger entries (also freezes assessedValue).
    const sale = recordSale(item, req.user.id);
    if (!sale.ok) return res.status(409).json({ error: sale.error });
    const amount = sale.X;

    const now = new Date().toISOString();
    const payment = {
      _id: nextId(PREFIX.PAYMENT),
      inventoryId,
      recyclerId: item.recyclerId,
      collectedBy: req.user.id,
      amount,
      method,
      note,
      status: 'collected',
      createdAt: now,
    };
    payments.push(payment);

    item.status = 'processed';
    item.processedAt = now;
    item.traceability.push({
      actor: req.user.id,
      actorName: users.find((u) => u._id === req.user.id)?.name,
      action: 'payment_collected',
      note: `₹${amount} via ${method}`,
      timestamp: now,
    });
    item.updatedAt = now;

    [item.sourceUserId, item.hubId].filter(Boolean).forEach((uid) =>
      notify(uid, {
        type: 'item_processed',
        title: 'Payout credited',
        message: `Your earnings for item ${item.qrCode} (${item.category}) have been credited.`,
        relatedId: item._id,
      })
    );
    if (item.recyclerId) {
      notify(item.recyclerId, {
        type: 'payment_recorded',
        title: 'Payment recorded',
        message: `Admin recorded your payment of ₹${amount} for item ${item.qrCode}.`,
      });
    }

    res.json({ message: 'Payment recorded and payouts credited', payment, item, payout: sale.parts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 4: Update the admin payment client call**

In `client/pages/dashboards/AdminDashboard.jsx`, find the mark-payment request (the call to `/api/admin/mark-payment`). Change its body to drop the manual amount — send only what the server now accepts:
```jsx
// was: body included { amount, ... }
await api.post('/api/admin/mark-payment', { inventoryId, method, note });
```
Remove the amount `<input>` from the payment dialog and replace it with an informational line, and surface the computed payout from the response:
```jsx
<p className="text-sm text-muted-foreground">
  The payout is computed automatically from the category catalog price × the item's quality grade,
  then split 60% seller / 20% platform / 20% hub.
</p>
```
On success, the response includes `payment.amount` (the computed X) and `payout` (`{ user, platform, hub }`) — show them in a confirmation (e.g. `alert(\`Recorded ₹${res.payment.amount} — seller ₹${res.payout.user}, hub ₹${res.payout.hub}\`)`), matching how this file already surfaces results. Adapt variable names to the existing handler in this file.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: client + server both `✓ built`. If the server fails on a missing `RewardEngine` reference elsewhere in admin.js, remove that reference too (there should be only the one call).

- [ ] **Step 6: Commit**

```bash
git add server/schemas.js server/routes/admin.js client/pages/dashboards/AdminDashboard.jsx
git commit -m "feat: mark-payment values item via catalog×grade and credits payouts"
```

---

### Task 9: Earnings read endpoint + remove reward routes/engine

**Files:**
- Create: `server/routes/earnings.js`
- Modify: `server/index.js`
- Modify: `server/routes/intent.js`
- Delete: `server/routes/rewards.js`, `server/services/rewardEngine.js`

- [ ] **Step 1: Create the earnings route**

`server/routes/earnings.js`:
```js
import { Router } from 'express';
import { verifyAuth } from '../middleware/auth.js';
import { balanceFor, ledgerFor } from '../services/payoutEngine.js';
import { inventory } from '../models/Inventory.js';

const router = Router();

/**
 * GET /api/earnings/mine — money balance + ledger for the logged-in user (any role).
 */
router.get('/mine', verifyAuth, (req, res) => {
  try {
    const entries = ledgerFor(req.user.id).map((e) => {
      const item = e.inventoryId ? inventory.find((i) => i._id === e.inventoryId) : null;
      return { ...e, category: item?.category || null, qrCode: item?.qrCode || null };
    });
    res.json({ balanceRs: balanceFor(req.user.id), entries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

- [ ] **Step 2: Register earnings, unregister rewards in index.js**

In `server/index.js`:
- Remove `import rewardRoutes from "./routes/rewards.js";` and add `import earningsRoutes from "./routes/earnings.js";`.
- Remove `app.use("/api/rewards", rewardRoutes);` and add `app.use("/api/earnings", earningsRoutes);`.

- [ ] **Step 3: Remove the intent rewards endpoint**

In `server/routes/intent.js`, delete the `GET /api/intent/rewards` route (the handler at `intent.js:235`, `router.get('/rewards', ...)`, through its closing `});`). Also remove the now-unused `import { rewards } from '../models/Reward.js';` if nothing else in the file uses it.

- [ ] **Step 4: Delete the dead reward files**

```bash
git rm server/routes/rewards.js server/services/rewardEngine.js
```

- [ ] **Step 5: Build to confirm nothing else references them**

Run: `npm run build:server`
Expected: `✓ built`. If it errors on a stray `rewardEngine`/`rewards` import, remove that reference and rebuild.

- [ ] **Step 6: Run the full server test suite**

Run: `npm test`
Expected: PASS (boxCodes, schemas, payoutEngine).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: /api/earnings/mine; remove gamification reward engine + routes"
```

---

### Task 10: Small-user earnings UI (replace rewards)

**Files:**
- Modify: `client/pages/dashboards/SmallUserDashboard.jsx`
- Modify: `client/pages/RewardWallet.jsx`

- [ ] **Step 1: Replace the rewards fetch**

In `SmallUserDashboard.jsx`, replace the rewards fetch (currently calling `/api/intent/rewards` into `rewardData`) with an earnings fetch:
```jsx
const [earnings, setEarnings] = useState({ balanceRs: 0, entries: [] });

const fetchEarnings = useCallback(async () => {
  try {
    const res = await apiFetch('/api/earnings/mine');
    if (res.ok) setEarnings(await res.json());
  } catch (err) { console.error('Failed to fetch earnings:', err); }
}, [apiFetch]);
```
Call `fetchEarnings()` everywhere `fetchRewards()` was called, then delete `fetchRewards` and the `rewardData`/`points`/`badges`/`milestones` derivations.

- [ ] **Step 2: Replace the header coins button + stats + sidebar**

- Header: replace the `/reward` "Coins" button label with the balance:
```jsx
<Link to="/reward">
  <Button variant="outline" size="sm" className="gap-2 border-primary/40 text-primary hover:bg-primary/5">
    <Coins className="w-4 h-4" />
    <span className="hidden sm:inline">₹{Math.round(earnings.balanceRs)}</span>
    <span className="sm:hidden">Wallet</span>
  </Button>
</Link>
```
- "Total Points" stat → "Total earnings": replace `{Math.round(points)}` with `₹{Math.round(earnings.balanceRs)}` and the label `Total Points` → `Total earnings`.
- Replace the entire rewards `<aside>` (wallet gradient + badges + milestones + tips) with an earnings list:
```jsx
<aside>
  <Link to="/reward" className="block mb-6">
    <div className="p-5 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-center hover:opacity-90 transition-opacity">
      <Coins className="w-8 h-8 mx-auto mb-2 opacity-90" />
      <p className="text-3xl font-bold">₹{Math.round(earnings.balanceRs)}</p>
      <p className="text-sm opacity-80">total earned</p>
      <p className="mt-2 text-xs bg-white/20 rounded-full px-3 py-1 inline-block">View wallet →</p>
    </div>
  </Link>
  <div className="mb-8">
    <h3 className="text-lg font-semibold text-foreground mb-4">Recent payouts</h3>
    {earnings.entries.length === 0 ? (
      <p className="text-sm text-muted-foreground">No payouts yet. You're paid when a recycler buys your item.</p>
    ) : (
      <div className="space-y-3">
        {earnings.entries.slice(0, 8).map((e) => (
          <div key={e._id} className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{e.category || 'Item'}</p>
              <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleDateString()}</p>
            </div>
            <span className="text-sm font-bold text-green-600">+₹{Math.round(e.amountRs)}</span>
          </div>
        ))}
      </div>
    )}
  </div>
</aside>
```
Remove now-unused imports (`Award`, `TrendingUp`, `CheckCircle2` if only used by the deleted sections — verify before removing).

- [ ] **Step 3: Repurpose the RewardWallet page**

In `client/pages/RewardWallet.jsx`, replace its data source with `/api/earnings/mine` and render the balance + full `entries` table (date, item/category, type, amount). Keep the page route `/reward` as-is in `App.jsx`. Concrete fetch:
```jsx
const [data, setData] = useState({ balanceRs: 0, entries: [] });
useEffect(() => {
  (async () => {
    try { const res = await api.get('/api/earnings/mine'); setData(res || { balanceRs: 0, entries: [] }); }
    catch (e) { console.error(e); }
  })();
}, []);
```
Render `₹{Math.round(data.balanceRs)}` as the headline and map `data.entries` into a table with columns: Date, Item (`entry.category`), Type (`entry.type.replace('_',' ')`), Amount (`+₹{Math.round(entry.amountRs)}`). Remove badge/milestone/streak rendering.

- [ ] **Step 4: Build the client**

Run: `npm run build:client`
Expected: `✓ built` with no unresolved imports.

- [ ] **Step 5: Manual check**

Dev server: as a small user whose item was just `processed`, the dashboard header shows `₹<balance>`, the sidebar lists the payout, and `/reward` shows the full ledger.

- [ ] **Step 6: Commit**

```bash
git add client/pages/dashboards/SmallUserDashboard.jsx client/pages/RewardWallet.jsx
git commit -m "feat: small-user money earnings view replaces rewards"
```

---

# PHASE 3 — Collector ledger & cleanup

### Task 11: Hub records collector payment

**Files:**
- Modify: `server/routes/hub.js`

- [ ] **Step 1: Add imports**

In `server/routes/hub.js`, add:
```js
import { recordCollectorPayment } from '../services/payoutEngine.js';
import { collectorPaymentSchema, validate } from '../schemas.js';
```
(If `validate` is already imported from `../schemas.js`, just add `collectorPaymentSchema` to that import and add the `recordCollectorPayment` import.)

- [ ] **Step 2: Add the route**

In `server/routes/hub.js`, add before `export default router`:
```js
/**
 * POST /api/hub/collector-payment — hub records what it pays the collector
 * who delivered this item. Recorded in rupees (1 pt = ₹1) on the ledger.
 */
router.post('/collector-payment', verifyAuth, requireRole('hub'), validate(collectorPaymentSchema), (req, res) => {
  try {
    const { inventoryId, amountRs } = req.body;
    const item = inventory.find((i) => i._id === inventoryId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.hubId !== req.user.id) return res.status(403).json({ error: 'This item is not at your hub.' });
    if (!item.collectorId) return res.status(409).json({ error: 'No collector recorded for this item.' });

    recordCollectorPayment(item.collectorId, inventoryId, amountRs, req.user.id);
    notify(item.collectorId, {
      type: 'collector_paid',
      title: 'Payment recorded',
      message: `A hub recorded a payment of ₹${amountRs} to you for item ${item.qrCode}.`,
      relatedId: item._id,
    });
    res.json({ message: 'Collector payment recorded', amountRs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```
(Confirm `inventory`, `verifyAuth`, `requireRole`, and `notify` are already imported in this file — they are used by existing hub routes.)

- [ ] **Step 3: Build**

Run: `npm run build:server`
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add server/routes/hub.js
git commit -m "feat: hub records collector payments to the ledger"
```

---

### Task 12: Hub UI — earnings + record-collector-payment action

**Files:**
- Modify: `client/pages/dashboards/HubDashboard.jsx`

- [ ] **Step 1: Fetch hub earnings**

Add state + fetch (the points badge was already removed earlier):
```jsx
const [earnings, setEarnings] = useState({ balanceRs: 0, entries: [] });
```
In `fetchData`, after loading inventory, add:
```jsx
try {
  const res = await apiFetch('/api/earnings/mine');
  if (res.ok) setEarnings(await res.json());
} catch { /* ignore */ }
```

- [ ] **Step 2: Show the hub balance in the header**

Add next to `NotificationsBell` in the header:
```jsx
<span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm font-medium" title="Your earnings">
  ₹{Math.round(earnings.balanceRs)}
</span>
```

- [ ] **Step 3: Add a "Record collector payment" action**

On verified/processed inventory rows that have a collector, add a small prompt-based action (kept minimal — uses `window.prompt`):
```jsx
const recordCollectorPayment = async (inventoryId) => {
  const raw = window.prompt('Amount to pay the collector for this item (₹):');
  if (raw == null) return;
  const amountRs = Number(raw);
  if (!Number.isFinite(amountRs) || amountRs <= 0) return alert('Enter a positive amount.');
  try {
    const res = await apiFetch('/api/hub/collector-payment', {
      method: 'POST',
      body: JSON.stringify({ inventoryId, amountRs }),
    });
    if (!res.ok) { const d = await res.json(); return alert(d.error || 'Failed.'); }
    alert('Collector payment recorded.');
    await fetchData();
  } catch { alert('Failed to record payment.'); }
};
```
Add a button in the verified-inventory expanded detail (where chain-of-custody renders), shown when `item.collectorId`:
```jsx
{item.collectorId && (
  <Button size="sm" variant="outline" onClick={() => recordCollectorPayment(item._id)}>
    Record collector payment
  </Button>
)}
```

- [ ] **Step 4: Build the client**

Run: `npm run build:client`
Expected: `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add client/pages/dashboards/HubDashboard.jsx
git commit -m "feat: hub earnings badge + record-collector-payment action"
```

---

### Task 13: Collector earnings UI

**Files:**
- Modify: `client/pages/dashboards/LocalCollectorDashboard.jsx`

- [ ] **Step 1: Fetch + show collector earnings**

Add state + fetch (re-add the `api` helper import if it was removed earlier: `import { api } from '@/lib/api';`):
```jsx
const [earnings, setEarnings] = useState({ balanceRs: 0, entries: [] });

const fetchEarnings = useCallback(async () => {
  try { const res = await api.get('/api/earnings/mine'); setEarnings(res || { balanceRs: 0, entries: [] }); }
  catch (err) { console.error(err); }
}, []);
```
Call `fetchEarnings()` from the existing load effect.

- [ ] **Step 2: Add an earnings card**

Add a card in the stats area showing the balance:
```jsx
<div className="p-5 rounded-lg border border-emerald-200 bg-emerald-50/50">
  <p className="text-sm text-muted-foreground mb-1">My earnings</p>
  <p className="text-2xl font-bold text-emerald-700">₹{Math.round(earnings.balanceRs)}</p>
</div>
```
Optionally add a "History" tab list of `earnings.entries` (date, item category, `+₹amount`). Minimal version: just the card above.

- [ ] **Step 3: Build the client**

Run: `npm run build:client`
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add client/pages/dashboards/LocalCollectorDashboard.jsx
git commit -m "feat: collector earnings view"
```

---

### Task 14: Remove delivery earnings (agents are off-system)

**Files:**
- Modify: `server/routes/delivery.js`
- Modify: `client/pages/dashboards/DeliveryWorkerDashboard.jsx`

- [ ] **Step 1: Remove the server endpoint**

In `server/routes/delivery.js`, delete the `GET /api/delivery/earnings` route (handler at `delivery.js:184`, `router.get('/earnings', ...)` through its closing `});`).

- [ ] **Step 2: Remove the client earnings UI**

In `DeliveryWorkerDashboard.jsx`, remove the earnings fetch/state and the earnings display (the `₹` "Earnings" element noted around lines 135–139), plus any now-unused imports.

- [ ] **Step 3: Build everything**

Run: `npm run build`
Expected: client + server both `✓ built`.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/delivery.js client/pages/dashboards/DeliveryWorkerDashboard.jsx
git commit -m "feat: remove delivery-agent earnings (off-system by design)"
```

---

## Final verification

- [ ] `npm run build` → client + server build clean.
- [ ] `npm test` → all unit tests pass (boxCodes, schemas incl. category price, payoutEngine).
- [ ] Manual end-to-end (dev server): admin sets a category price → item flows to `delivered` and is graded by the recycler technician → admin `mark-payment` computes `X` and credits user/platform/hub → small-user dashboard + `/reward` show the payout → hub records a collector payment → collector dashboard shows it → delivery dashboard has no earnings section.
```
