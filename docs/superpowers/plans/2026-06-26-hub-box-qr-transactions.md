# Hub Box QR Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-unit hub QR stickers with a box-based model: one verified item is packed into N boxes under a `TR-YYYYMMDDHHMMSS` transaction, each box gets a `BI-XXX0001` ID + signed QR, an item is only `verified` once the hub clicks Print, and the recycler acknowledges receipt by confirming every box's QR.

**Architecture:** A new pure-logic module (`boxCodes.js`) generates transaction numbers, box IDs, signed QR payloads, and per-box weight splits. A new `boxes` Postgres table (plus in-memory `boxes` array, wired through `pgStore`) stores one row per box. The hub `/verify` endpoint becomes a two-step **prepare → confirm-print**: prepare stages the item (`pending_print`) and creates pending box rows for preview; confirm-print flips the item to `verified` and boxes to `printed`. The recycler gets `GET /boxes` + `POST /acknowledge`, scanning/confirming each box QR (server-verified) until all are acknowledged.

**Tech Stack:** Node + Express (ESM), Postgres via `pg`, Zod validation, Vitest for unit tests, React 18 client with the `qrcode` package for local QR image generation.

---

## Notes / deviations from the spec

Two refinements discovered while reading the codebase:

1. **DB creation uses a new `server/db/apply-schema.mjs`, not `migrate.mjs`.** `migrate.mjs` loads `server/data/*.json` which were deleted; running it now would crash, and there is no `boxes.json`. The `boxes` table is added to `schema.sql` (idempotent `create table if not exists`) and applied with a small schema-only script. `migrate.mjs` is left untouched.
2. **The app has no QR camera-decoder.** The existing delivery "scan" simulates scanning by submitting known QR strings (`DeliveryWorkerDashboard.jsx:64-69`). The recycler acknowledgment follows the same pattern: the client already holds each box's `qrPayload` (from `GET /recycler/boxes`) and submits it on a per-box "Scan / Confirm" tap, plus a manual paste field for a real scanner. The **server still cryptographically verifies** every payload via `verifyBoxQr`.

## Testing approach

This repo has Vitest configured (`npm test` → `vitest --run`) but **no existing tests**. We TDD the pure logic (`boxCodes.js`, Zod schemas) with Vitest, and verify routes + React UI manually through the running app (`npm run dev`), since the project ships no HTTP/component test harness and adding one is out of scope (YAGNI).

## File structure

**New files**
- `server/utils/boxCodes.js` — transaction no / box id / signed QR payload / weight split (pure functions).
- `server/utils/boxCodes.test.js` — Vitest unit tests for the above.
- `server/models/Box.js` — in-memory `boxes` array.
- `server/db/apply-schema.mjs` — idempotent schema-only apply script.
- `client/components/BoxStickerSheet.jsx` — per-box printable stickers.

**Modified files**
- `server/db/schema.sql` — add `boxes` table + indexes.
- `server/lib/pgStore.js` — register `boxes` in `TABLES` + import.
- `server/schemas.js` — `boxCount` on `hubVerifySchema`; add `confirmPrintSchema`, `acknowledgeBoxSchema`.
- `server/routes/hub.js` — prepare (`/verify`) + `/confirm-print`; widen `/incoming` to include `pending_print`.
- `server/routes/recycler.js` — `GET /boxes`, `POST /acknowledge`.
- `client/pages/dashboards/HubDashboard.jsx` — box-count input, stage→print flow, pending-print resume.
- `client/pages/dashboards/RecyclerDashboard.jsx` — box receipt acknowledgment section.

---

## Task 1: `boxCodes.js` — transaction number & box ID

**Files:**
- Create: `server/utils/boxCodes.js`
- Test: `server/utils/boxCodes.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/utils/boxCodes.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  formatTransactionNo,
  generateTransactionNo,
  makeBoxId,
  generateBoxPrefix,
} from './boxCodes.js';

describe('transaction number', () => {
  it('formats a date as TR-YYYYMMDDHHMMSS (local components)', () => {
    // June = month index 5
    expect(formatTransactionNo(new Date(2026, 5, 26, 14, 30, 0))).toBe('TR-20260626143000');
  });

  it('returns the base when free', () => {
    expect(generateTransactionNo([], new Date(2026, 5, 26, 14, 30, 0))).toBe('TR-20260626143000');
  });

  it('appends -2 on a same-second collision', () => {
    expect(
      generateTransactionNo(['TR-20260626143000'], new Date(2026, 5, 26, 14, 30, 0)),
    ).toBe('TR-20260626143000-2');
  });
});

describe('box id', () => {
  it('zero-pads the sequence to 4 digits', () => {
    expect(makeBoxId('ABC', 1)).toBe('BI-ABC0001');
    expect(makeBoxId('ABC', 12)).toBe('BI-ABC0012');
  });

  it('picks 3 letters whose BI-XXX0001 is free', () => {
    expect(generateBoxPrefix([], () => 0)).toBe('AAA');
  });

  it('retries when the prefix is taken', () => {
    const seq = [0, 0, 0, 0.99, 0.99, 0.99]; // AAA (taken) then ZZZ (free)
    let i = 0;
    const rng = () => seq[i++];
    expect(generateBoxPrefix(['BI-AAA0001'], rng)).toBe('ZZZ');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/utils/boxCodes.test.js`
Expected: FAIL — `Failed to resolve import "./boxCodes.js"` / functions undefined.

- [ ] **Step 3: Implement the module**

Create `server/utils/boxCodes.js`:

```js
import crypto from 'crypto';

function qrSecret() {
  return process.env.JWT_SECRET || 'dev-qr-secret-change-me';
}

const pad = (n, w) => String(n).padStart(w, '0');

/** Format a Date as TR-YYYYMMDDHHMMSS using local time components. */
export function formatTransactionNo(date = new Date()) {
  return (
    'TR-' +
    date.getFullYear() +
    pad(date.getMonth() + 1, 2) +
    pad(date.getDate(), 2) +
    pad(date.getHours(), 2) +
    pad(date.getMinutes(), 2) +
    pad(date.getSeconds(), 2)
  );
}

/** Unique transaction number; appends -2, -3… on a same-second collision. */
export function generateTransactionNo(existing = [], date = new Date()) {
  const base = formatTransactionNo(date);
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** BI-<prefix><4-digit seq>, e.g. makeBoxId('ABC', 1) -> 'BI-ABC0001'. */
export function makeBoxId(prefix, seq) {
  return `BI-${prefix}${pad(seq, 4)}`;
}

/** 3 random uppercase letters whose BI-XXX0001 is not already used. */
export function generateBoxPrefix(existingBoxIds = [], rng = Math.random) {
  const taken = new Set(existingBoxIds);
  const letter = () => String.fromCharCode(65 + Math.floor(rng() * 26));
  for (let attempt = 0; attempt < 1000; attempt++) {
    const prefix = letter() + letter() + letter();
    if (!taken.has(makeBoxId(prefix, 1))) return prefix;
  }
  throw new Error('Could not allocate a free box prefix');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/utils/boxCodes.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/utils/boxCodes.js server/utils/boxCodes.test.js
git commit -m "feat: box code generators (transaction no + box id)"
```

---

## Task 2: `boxCodes.js` — signed QR payload sign/verify

**Files:**
- Modify: `server/utils/boxCodes.js`
- Test: `server/utils/boxCodes.test.js`

- [ ] **Step 1: Add failing tests**

Append to `server/utils/boxCodes.test.js` (and add `boxQrPayload, verifyBoxQr` to the existing import from `./boxCodes.js`):

```js
import { boxQrPayload, verifyBoxQr } from './boxCodes.js'; // merge into the top import

describe('box QR payload', () => {
  it('round-trips transaction + box id through sign/verify', () => {
    const p = boxQrPayload('TR-20260626143000', 'BI-ABC0001');
    expect(p.startsWith('BOX.TR-20260626143000.BI-ABC0001.')).toBe(true);
    expect(verifyBoxQr(p)).toEqual({
      transactionNo: 'TR-20260626143000',
      boxId: 'BI-ABC0001',
    });
  });

  it('rejects tampered or malformed payloads', () => {
    const p = boxQrPayload('TR-20260626143000', 'BI-ABC0001');
    expect(verifyBoxQr(p.slice(0, -1) + '0')).toBeNull(); // last sig char flipped
    expect(verifyBoxQr('garbage')).toBeNull();
    expect(verifyBoxQr('BOX.a.b')).toBeNull(); // too few parts
    expect(verifyBoxQr(null)).toBeNull();
  });
});
```

> Note: keep a single `import { … } from './boxCodes.js'` at the top of the test file listing all functions used; do not add a second import line if your tooling complains.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/utils/boxCodes.test.js`
Expected: FAIL — `boxQrPayload`/`verifyBoxQr` are not exported.

- [ ] **Step 3: Implement sign/verify**

Append to `server/utils/boxCodes.js`:

```js
/** Signed QR payload encoding the transaction + box id. */
export function boxQrPayload(transactionNo, boxId) {
  const body = `BOX.${transactionNo}.${boxId}`;
  const sig = crypto.createHmac('sha256', qrSecret()).update(body).digest('hex').slice(0, 12);
  return `${body}.${sig}`;
}

/** { transactionNo, boxId } when the signature is valid, else null. */
export function verifyBoxQr(payload) {
  if (typeof payload !== 'string') return null;
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== 'BOX') return null;
  const [, transactionNo, boxId, sig] = parts;
  const expect = crypto
    .createHmac('sha256', qrSecret())
    .update(`BOX.${transactionNo}.${boxId}`)
    .digest('hex')
    .slice(0, 12);
  let valid = false;
  try {
    valid =
      sig.length === expect.length &&
      crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expect, 'utf8'));
  } catch {
    valid = false;
  }
  return valid ? { transactionNo, boxId } : null;
}
```

> `transactionNo` (`TR-…`, optionally `-N`) and `boxId` (`BI-…`) contain no `.`, so `split('.')` yields exactly 4 parts.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/utils/boxCodes.test.js`
Expected: PASS (all tests, including the 2 new blocks).

- [ ] **Step 5: Commit**

```bash
git add server/utils/boxCodes.js server/utils/boxCodes.test.js
git commit -m "feat: signed box QR payload sign/verify"
```

---

## Task 3: `boxCodes.js` — net weight split

**Files:**
- Modify: `server/utils/boxCodes.js`
- Test: `server/utils/boxCodes.test.js`

- [ ] **Step 1: Add failing tests**

Append to `server/utils/boxCodes.test.js` (add `splitNetWeight` to the top import):

```js
describe('splitNetWeight', () => {
  it('splits evenly when divisible', () => {
    expect(splitNetWeight(12, 3)).toEqual([4, 4, 4]);
  });

  it('puts the rounding remainder on the last box', () => {
    expect(splitNetWeight(10, 3)).toEqual([3.33, 3.33, 3.34]);
  });

  it('returns nulls when no weight was entered', () => {
    expect(splitNetWeight(null, 2)).toEqual([null, null]);
    expect(splitNetWeight('', 2)).toEqual([null, null]);
  });

  it('handles a single box', () => {
    expect(splitNetWeight(7.5, 1)).toEqual([7.5]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/utils/boxCodes.test.js`
Expected: FAIL — `splitNetWeight` is not exported.

- [ ] **Step 3: Implement the split**

Append to `server/utils/boxCodes.js`:

```js
/** Split a total weight into `count` per-box weights summing to the total (2dp). */
export function splitNetWeight(totalKg, count) {
  const n = Math.max(1, Math.floor(count) || 1);
  if (totalKg == null || totalKg === '' || isNaN(Number(totalKg))) {
    return Array.from({ length: n }, () => null);
  }
  const total = Number(totalKg);
  const per = Math.floor((total / n) * 100) / 100;
  const weights = Array.from({ length: n }, () => per);
  weights[n - 1] = Math.round((total - per * (n - 1)) * 100) / 100;
  return weights;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/utils/boxCodes.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add server/utils/boxCodes.js server/utils/boxCodes.test.js
git commit -m "feat: per-box net weight split"
```

---

## Task 4: Box model array

**Files:**
- Create: `server/models/Box.js`

- [ ] **Step 1: Create the model**

Create `server/models/Box.js`:

```js
// Filled from Postgres at boot by pgStore.hydrateAll(); mutated in place by routes.
export const boxes = [];
```

- [ ] **Step 2: Sanity check it imports**

Run: `node -e "import('./server/models/Box.js').then(m => console.log(Array.isArray(m.boxes)))"`
Expected: prints `true`.

- [ ] **Step 3: Commit**

```bash
git add server/models/Box.js
git commit -m "feat: boxes in-memory model array"
```

---

## Task 5: Postgres `boxes` table + schema apply + pgStore wiring

**Files:**
- Modify: `server/db/schema.sql`
- Create: `server/db/apply-schema.mjs`
- Modify: `server/lib/pgStore.js`

- [ ] **Step 1: Add the `boxes` table to `schema.sql`**

Append to the end of `server/db/schema.sql`:

```sql
-- 11. boxes (one physical box printed at a hub) --------------------------
create table if not exists boxes (
  id               text primary key,              -- BI-XXX0001
  transaction_no   text not null,                 -- TR-YYYYMMDDHHMMSS
  inventory_id     text references inventory(id),
  qr_payload       text unique,                   -- signed BOX.<tr>.<boxId>.<sig>
  item_name        text,
  net_weight_kg    numeric,
  unit             text,
  box_seq          integer,
  box_count        integer,
  hub_id           text references users(id),
  hub_name         text,
  status           text default 'pending_print',  -- pending_print | printed | acknowledged
  recycler_id      text references users(id),
  recycler_company text,
  acknowledged_at  timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists idx_boxes_inventory   on boxes(inventory_id);
create index if not exists idx_boxes_recycler     on boxes(recycler_id);
create index if not exists idx_boxes_transaction  on boxes(transaction_no);
```

- [ ] **Step 2: Create the schema-apply script**

Create `server/db/apply-schema.mjs`:

```js
/**
 * Apply server/db/schema.sql to the database (idempotent — create-if-not-exists).
 * Use this to add new tables without re-running the JSON data migration.
 *
 * Run from project root:  node server/db/apply-schema.mjs
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    console.log('✅ schema.sql applied');
  } catch (e) {
    console.error('❌ apply-schema failed:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
```

- [ ] **Step 3: Register `boxes` in `pgStore.js`**

In `server/lib/pgStore.js`, add the import after the other model imports (after the `recyclerRequests` import, ~line 22):

```js
import { boxes } from '../models/Box.js';
```

Then add this entry to the `TABLES` array **immediately after the `inventory` entry** (it depends on `users` + `inventory`, both already earlier, so inserts satisfy the FKs):

```js
  {
    name: 'boxes',
    array: boxes,
    columns: ['id', 'transaction_no', 'inventory_id', 'qr_payload', 'item_name', 'net_weight_kg', 'unit', 'box_seq', 'box_count', 'hub_id', 'hub_name', 'status', 'recycler_id', 'recycler_company', 'acknowledged_at', 'created_at', 'updated_at'],
    jsonb: [],
    fromRow: (r) => ({ _id: r.id, transactionNo: r.transaction_no, inventoryId: r.inventory_id, qrPayload: r.qr_payload, itemName: r.item_name, netWeightKg: r.net_weight_kg, unit: r.unit, boxSeq: r.box_seq, boxCount: r.box_count, hubId: r.hub_id, hubName: r.hub_name, status: r.status, recyclerId: r.recycler_id, recyclerCompany: r.recycler_company, acknowledgedAt: iso(r.acknowledged_at), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) }),
    toRow: (r) => [r._id, r.transactionNo, nz(r.inventoryId), nz(r.qrPayload), r.itemName ?? null, r.netWeightKg ?? null, r.unit ?? null, r.boxSeq ?? null, r.boxCount ?? null, nz(r.hubId), r.hubName ?? null, r.status ?? 'pending_print', nz(r.recyclerId), r.recyclerCompany ?? null, r.acknowledgedAt ?? null, r.createdAt, r.updatedAt],
  },
```

- [ ] **Step 4: Apply the schema to the database**

Run: `node server/db/apply-schema.mjs`
Expected: prints `✅ schema.sql applied` (idempotent — safe even though other tables already exist).

> Requires `DATABASE_URL` in `.env`. If the DB is unreachable in your environment, skip the run and apply the `create table boxes …` block via your Postgres console instead; the table must exist before the server boots (pgStore hydrates `select * from boxes` at startup).

- [ ] **Step 5: Verify boot hydrates boxes**

Run: `npm run dev` and watch the server log.
Expected: the `[pgStore] hydrated from Postgres:` line now includes `boxes=0` (or current count) with no error. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add server/db/schema.sql server/db/apply-schema.mjs server/lib/pgStore.js
git commit -m "feat: boxes Postgres table + pgStore wiring + schema apply script"
```

---

## Task 6: Zod schemas

**Files:**
- Modify: `server/schemas.js`
- Test: `server/schemas.test.js` (new)

- [ ] **Step 1: Write failing tests**

Create `server/schemas.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { hubVerifySchema, confirmPrintSchema, acknowledgeBoxSchema } from './schemas.js';

describe('hubVerifySchema', () => {
  it('defaults boxCount to 1 when omitted', () => {
    const parsed = hubVerifySchema.parse({ inventoryId: 'ITEM-1', actualQty: 3 });
    expect(parsed.boxCount).toBe(1);
  });

  it('accepts a positive integer boxCount', () => {
    const parsed = hubVerifySchema.parse({ inventoryId: 'ITEM-1', actualQty: 3, boxCount: 4 });
    expect(parsed.boxCount).toBe(4);
  });

  it('rejects boxCount < 1', () => {
    expect(() => hubVerifySchema.parse({ inventoryId: 'ITEM-1', actualQty: 3, boxCount: 0 })).toThrow();
  });
});

describe('confirmPrintSchema / acknowledgeBoxSchema', () => {
  it('requires inventoryId', () => {
    expect(() => confirmPrintSchema.parse({})).toThrow();
    expect(confirmPrintSchema.parse({ inventoryId: 'ITEM-1' })).toEqual({ inventoryId: 'ITEM-1' });
  });

  it('requires scannedQr', () => {
    expect(() => acknowledgeBoxSchema.parse({})).toThrow();
    expect(acknowledgeBoxSchema.parse({ scannedQr: 'BOX.x.y.z' })).toEqual({ scannedQr: 'BOX.x.y.z' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/schemas.test.js`
Expected: FAIL — `confirmPrintSchema`/`acknowledgeBoxSchema` not exported and `boxCount` missing.

- [ ] **Step 3: Update `hubVerifySchema` and add the new schemas**

In `server/schemas.js`, replace the existing `hubVerifySchema` (lines ~58-65) with:

```js
export const hubVerifySchema = z.object({
  inventoryId: z.string().min(1),
  actualQty: z.number().nonnegative(),
  weightKg: z.number().nonnegative().nullable().optional(),
  condition: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  photos: z.array(z.string()).optional(),
  boxCount: z.number().int().positive().max(1000).optional().default(1),
});

export const confirmPrintSchema = z.object({
  inventoryId: z.string().min(1),
});

export const acknowledgeBoxSchema = z.object({
  scannedQr: z.string().min(1),
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/schemas.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/schemas.js server/schemas.test.js
git commit -m "feat: boxCount + confirm-print + acknowledge schemas"
```

---

## Task 7: Hub routes — prepare, confirm-print, widen incoming

**Files:**
- Modify: `server/routes/hub.js`

- [ ] **Step 1: Update imports**

In `server/routes/hub.js`, replace the helpers import (line 5) and the schemas import (line 7), and add the box imports:

```js
import { maskCode } from '../utils/helpers.js';
import { boxes } from '../models/Box.js';
import {
  generateTransactionNo,
  generateBoxPrefix,
  makeBoxId,
  boxQrPayload,
  splitNetWeight,
} from '../utils/boxCodes.js';
```

And change the schemas import (line 7) to:

```js
import { validate, hubVerifySchema, confirmPrintSchema } from '../schemas.js';
```

> `generateUnitQRCodes` is no longer used; ensure it is removed from the helpers import.

- [ ] **Step 2: Replace the `/verify` handler with the prepare flow**

Replace the entire `router.post('/verify', …)` handler (lines ~37-100) with:

```js
/**
 * POST /api/hub/verify — STAGE for printing. Records actual qty/weight/condition,
 * sets the item to pending_print, and creates the box rows for preview.
 * The item is NOT verified until /confirm-print is called.
 */
router.post('/verify', verifyAuth, requireRole('hub'), validate(hubVerifySchema), (req, res) => {
  try {
    const { inventoryId, actualQty, weightKg, condition, category, photos, boxCount } = req.body;
    const item = inventory.find((i) => i._id === inventoryId);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    if (item.status === 'verified') {
      return res.status(409).json({ error: 'Item is already verified.' });
    }

    const now = new Date().toISOString();
    if (item.claimedQty == null) item.claimedQty = item.actualQty;
    if (!item.claimedCategory) item.claimedCategory = item.category;

    item.actualQty = Number(actualQty);
    if (weightKg !== undefined && weightKg !== null && weightKg !== '') item.weightKg = Number(weightKg);
    item.condition = condition || item.condition;
    item.category = category || item.category;
    if (Array.isArray(photos)) item.verificationPhotos.push(...photos);
    item.hubId = req.user.id;
    item.status = 'pending_print';
    item.updatedAt = now;

    const me = users.find((u) => u._id === req.user.id);
    const count = Math.max(1, Math.floor(Number(boxCount) || 1));

    // Reuse existing pending boxes if the count is unchanged; otherwise rebuild.
    let myBoxes = boxes.filter((b) => b.inventoryId === item._id && b.status === 'pending_print');
    if (myBoxes.length !== count) {
      for (let i = boxes.length - 1; i >= 0; i--) {
        if (boxes[i].inventoryId === item._id && boxes[i].status === 'pending_print') boxes.splice(i, 1);
      }
      const transactionNo = generateTransactionNo(boxes.map((b) => b.transactionNo));
      const prefix = generateBoxPrefix(boxes.map((b) => b._id));
      const weights = splitNetWeight(item.weightKg, count);
      myBoxes = [];
      for (let i = 0; i < count; i++) {
        const boxId = makeBoxId(prefix, i + 1);
        const box = {
          _id: boxId,
          transactionNo,
          inventoryId: item._id,
          qrPayload: boxQrPayload(transactionNo, boxId),
          itemName: item.category,
          netWeightKg: weights[i],
          unit: item.unit,
          boxSeq: i + 1,
          boxCount: count,
          hubId: req.user.id,
          hubName: me?.name || '',
          status: 'pending_print',
          recyclerId: null,
          recyclerCompany: null,
          acknowledgedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        boxes.push(box);
        myBoxes.push(box);
      }
    }

    res.json({
      message: 'Item staged for printing',
      item,
      transactionNo: myBoxes[0]?.transactionNo,
      boxes: myBoxes.map((b) => ({
        boxId: b._id,
        transactionNo: b.transactionNo,
        qrPayload: b.qrPayload,
        itemName: b.itemName,
        netWeightKg: b.netWeightKg,
        unit: b.unit,
        boxSeq: b.boxSeq,
        boxCount: b.boxCount,
        hubName: b.hubName,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/hub/confirm-print — the hub clicked Print. Boxes -> printed,
 * item -> verified, admins notified. This is the ONLY path to 'verified'.
 */
router.post('/confirm-print', verifyAuth, requireRole('hub'), validate(confirmPrintSchema), (req, res) => {
  try {
    const { inventoryId } = req.body;
    const item = inventory.find((i) => i._id === inventoryId);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    if (item.hubId !== req.user.id) return res.status(403).json({ error: 'Not your item' });

    const myBoxes = boxes.filter((b) => b.inventoryId === item._id && b.status === 'pending_print');
    if (myBoxes.length === 0) {
      return res.status(400).json({ error: 'No staged boxes to print. Stage the item first.' });
    }

    const now = new Date().toISOString();
    myBoxes.forEach((b) => {
      b.status = 'printed';
      b.updatedAt = now;
    });
    item.status = 'verified';
    item.hubVerifiedAt = now;
    item.updatedAt = now;

    const me = users.find((u) => u._id === req.user.id);
    item.traceability.push({
      actor: req.user.id,
      actorName: me?.name,
      action: 'verified_at_hub',
      timestamp: now,
    });

    const admins = users.filter((u) => u.role === 'admin');
    admins.forEach((a) =>
      notify(a._id, {
        type: 'hub_verified',
        title: 'New verified batch ready',
        message: `${me?.name || 'A hub'} verified ${item.actualQty} × ${item.category} (${myBoxes.length} box${myBoxes.length > 1 ? 'es' : ''}). Awaiting your approval to assign to a recycler.`,
        relatedId: item._id,
      }),
    );

    res.json({ message: 'Printed & verified', item, printedBoxes: myBoxes.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 3: Keep `pending_print` items visible in `/incoming`**

In `server/routes/hub.js`, change the `/incoming` filter (line ~16-17) from:

```js
      .filter((i) => i.status === 'at_hub' && (!i.hubId || i.hubId === req.user.id))
```

to:

```js
      .filter(
        (i) =>
          (i.status === 'at_hub' && (!i.hubId || i.hubId === req.user.id)) ||
          (i.status === 'pending_print' && i.hubId === req.user.id),
      )
```

- [ ] **Step 4: Manual verification (UI)**

Run `npm run dev`. Log in as a hub that has an `at_hub` item.
1. Open Verify, set Box count = 3, Stage → the dialog shows 3 box stickers with `TR-…` and `BI-XXX0001/0002/0003` (this comes together in Task 10; for now verify via the Network tab that `POST /api/hub/verify` returns `boxes: [3]` and the item is gone from "verified" inventory but still listed under incoming as `pending_print`).
2. Confirm the item is **not** in `GET /api/hub/inventory` yet.
3. Call `POST /api/hub/confirm-print` (via the UI in Task 10, or temporarily via the Network tab) → item appears in `GET /api/hub/inventory` as `verified` and an admin notification is created.

Expected: an item only reaches `verified` after confirm-print; before that it sits in `incoming` as `pending_print`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/hub.js
git commit -m "feat: hub prepare/confirm-print box flow; keep pending_print in incoming"
```

---

## Task 8: Recycler routes — list boxes + acknowledge

**Files:**
- Modify: `server/routes/recycler.js`

- [ ] **Step 1: Update imports**

In `server/routes/recycler.js`, add after the existing model imports:

```js
import { boxes } from '../models/Box.js';
import { verifyBoxQr } from '../utils/boxCodes.js';
```

And add `acknowledgeBoxSchema` to the existing schemas import line:

```js
import { validate, assignDeliverySchema, recyclerRequestSchema, acknowledgeBoxSchema } from '../schemas.js';
```

- [ ] **Step 2: Add the two endpoints**

In `server/routes/recycler.js`, add these handlers just before `export default router;`:

```js
/**
 * GET /api/recycler/boxes — boxes for my delivered items, grouped by item.
 */
router.get('/boxes', verifyAuth, requireRole('recycler'), (req, res) => {
  try {
    const myItems = new Map(
      inventory.filter((i) => i.recyclerId === req.user.id).map((i) => [i._id, i]),
    );
    const visible = boxes.filter((b) => {
      const it = myItems.get(b.inventoryId);
      if (!it) return false;
      return ['delivered', 'processed'].includes(it.status) || b.status === 'acknowledged';
    });

    const groups = {};
    for (const b of visible) {
      if (!groups[b.inventoryId]) {
        const it = myItems.get(b.inventoryId);
        groups[b.inventoryId] = {
          inventoryId: b.inventoryId,
          itemName: b.itemName || it?.category,
          transactionNo: b.transactionNo,
          total: 0,
          acknowledged: 0,
          boxes: [],
        };
      }
      const g = groups[b.inventoryId];
      g.total += 1;
      if (b.status === 'acknowledged') g.acknowledged += 1;
      g.boxes.push({
        boxId: b._id,
        qrPayload: b.qrPayload,
        netWeightKg: b.netWeightKg,
        boxSeq: b.boxSeq,
        boxCount: b.boxCount,
        status: b.status,
      });
    }
    const items = Object.values(groups).map((g) => ({
      ...g,
      boxes: g.boxes.sort((a, b) => a.boxSeq - b.boxSeq),
    }));
    res.json({ items, total: items.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/recycler/acknowledge — recycler scanned a box QR on receipt.
 * Records the recycler company on the box; marks the item received once all boxes are in.
 */
router.post('/acknowledge', verifyAuth, requireRole('recycler'), validate(acknowledgeBoxSchema), (req, res) => {
  try {
    const { scannedQr } = req.body;
    const decoded = verifyBoxQr(scannedQr);
    if (!decoded) return res.status(400).json({ error: 'Invalid or unrecognised QR code.' });

    const box = boxes.find((b) => b._id === decoded.boxId);
    if (!box) return res.status(404).json({ error: 'Box not found.' });

    const item = inventory.find((i) => i._id === box.inventoryId);
    if (!item || item.recyclerId !== req.user.id) {
      return res.status(403).json({ error: 'This box is not assigned to you.' });
    }
    if (!['delivered', 'processed'].includes(item.status)) {
      return res.status(409).json({ error: 'Item has not been delivered yet.' });
    }

    const me = users.find((u) => u._id === req.user.id);
    const now = new Date().toISOString();
    if (box.status !== 'acknowledged') {
      box.status = 'acknowledged';
      box.recyclerId = req.user.id;
      box.recyclerCompany = me?.name || '';
      box.acknowledgedAt = now;
      box.updatedAt = now;
    }

    const itemBoxes = boxes.filter((b) => b.inventoryId === item._id);
    const acknowledged = itemBoxes.filter((b) => b.status === 'acknowledged').length;
    const complete = itemBoxes.length > 0 && acknowledged === itemBoxes.length;
    if (complete && !item.traceability.some((t) => t.action === 'received_at_recycler')) {
      item.traceability.push({
        actor: req.user.id,
        actorName: me?.name,
        action: 'received_at_recycler',
        timestamp: now,
      });
      item.updatedAt = now;
    }

    res.json({ message: 'Box acknowledged', boxId: box._id, acknowledged, total: itemBoxes.length, complete });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 3: Manual verification (UI in Task 11, or Network tab)**

With a recycler whose item has been `delivered` and printed boxes:
1. `GET /api/recycler/boxes` returns the item with `total = N`, `acknowledged = 0`, and N boxes each with a `qrPayload`.
2. `POST /api/recycler/acknowledge` with `{ "scannedQr": "<one box's qrPayload>" }` → returns `acknowledged: 1, total: N, complete: false`; the box's `recyclerCompany` is set to the recycler's name.
3. Acknowledge all N → final response `complete: true`; the item gains a `received_at_recycler` traceability entry.
4. `POST /api/recycler/acknowledge` with a tampered/foreign QR → `400 Invalid or unrecognised QR code.` (or `403` if it belongs to another recycler).

- [ ] **Step 4: Commit**

```bash
git add server/routes/recycler.js
git commit -m "feat: recycler box listing + scan-to-acknowledge"
```

---

## Task 9: `BoxStickerSheet` component

**Files:**
- Create: `client/components/BoxStickerSheet.jsx`

- [ ] **Step 1: Create the component**

Create `client/components/BoxStickerSheet.jsx`:

```jsx
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Printable per-box QR stickers. The QR encodes the signed payload (TR + Box ID);
 * the visible text shows item name, net weight, transaction number and box id.
 *
 * Props:
 *   boxes    : Array<{ boxId, transactionNo, qrPayload, itemName, netWeightKg, unit, boxSeq, boxCount, hubName }>
 *   onPrint? : () => void   — called when "Print all" is pressed (use to confirm-print server-side)
 */
export default function BoxStickerSheet({ boxes = [], onPrint }) {
  const [images, setImages] = useState({}); // qrPayload -> data URL

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        boxes.map(async (b) => {
          try {
            return [b.qrPayload, await QRCode.toDataURL(b.qrPayload, { width: 180, margin: 1 })];
          } catch {
            return [b.qrPayload, ''];
          }
        }),
      );
      if (!cancelled) setImages(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxes.map((b) => b.qrPayload).join('|')]);

  if (!boxes.length) return null;

  const printAll = () => {
    onPrint?.();
    const stickers = boxes
      .map(
        (b) => `
      <div class="sticker">
        <img src="${images[b.qrPayload] || ''}" alt="QR" />
        <div class="info">
          <div class="cat">${b.itemName || ''}</div>
          <div class="row">Box <strong>${b.boxSeq} of ${b.boxCount}</strong></div>
          ${b.netWeightKg != null ? `<div class="row">Net wt: <strong>${b.netWeightKg} kg</strong></div>` : ''}
          <div class="row">Txn: ${b.transactionNo}</div>
          <div class="code">${b.boxId}</div>
          <div class="foot">${b.hubName ? 'Hub: ' + b.hubName : ''} · E-Waste Hub</div>
        </div>
      </div>`,
      )
      .join('');
    const html = `<!doctype html><html><head><title>${boxes[0]?.itemName || 'Item'} box stickers</title>
      <style>
        @page { size: 80mm 50mm; margin: 4mm; }
        body { font-family: -apple-system, Segoe UI, Arial, sans-serif; margin: 0; color: #111; }
        .sticker { display: flex; gap: 10px; border: 1px solid #111; border-radius: 6px; padding: 8px; width: 300px; margin-bottom: 8px; page-break-after: always; }
        .sticker img { width: 120px; height: 120px; }
        .info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
        .cat { font-weight: 700; font-size: 14px; }
        .row { font-size: 12px; }
        .code { font-family: ui-monospace, Menlo, monospace; font-size: 11px; font-weight: 700; color: #111; margin-top: 2px; }
        .foot { font-size: 10px; color: #666; margin-top: 4px; }
      </style></head><body>${stickers}
      <script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},300);}</script>
      </body></html>`;
    const w = window.open('', '_blank', 'width=520,height=640');
    if (!w) return alert('Pop-up blocked. Please allow pop-ups to print stickers.');
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {boxes.length} box sticker{boxes.length > 1 ? 's' : ''} — print one per box
        </p>
        <Button size="sm" variant="outline" onClick={printAll} className="gap-1 h-8 text-xs">
          <Printer className="w-3.5 h-3.5" /> Print all
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
        {boxes.map((b) => (
          <div key={b.boxId} className="border border-border rounded-md p-2 bg-white text-black flex gap-2 items-center">
            {images[b.qrPayload] ? (
              <img src={images[b.qrPayload]} alt={`QR ${b.boxId}`} className="w-20 h-20 flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center text-[10px] text-gray-400">…</div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-xs truncate">{b.itemName}</p>
              <p className="text-[11px]">
                Box {b.boxSeq} of {b.boxCount}
                {b.netWeightKg != null ? ` · ${b.netWeightKg} kg` : ''}
              </p>
              <p className="text-[10px] text-gray-500">{b.transactionNo}</p>
              <p className="text-[11px] font-mono font-semibold break-all">{b.boxId}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `npx vite build` (or rely on `npm run dev` hot reload in Task 10).
Expected: no import/syntax errors for `BoxStickerSheet.jsx`.

- [ ] **Step 3: Commit**

```bash
git add client/components/BoxStickerSheet.jsx
git commit -m "feat: BoxStickerSheet printable per-box stickers"
```

---

## Task 10: Hub dashboard — box count, stage → print, resume

**Files:**
- Modify: `client/pages/dashboards/HubDashboard.jsx`

- [ ] **Step 1: Swap the sticker import**

In `client/pages/dashboards/HubDashboard.jsx`, replace line 24:

```jsx
import QRStickerSheet from "@/components/QRStickerSheet";
```

with:

```jsx
import BoxStickerSheet from "@/components/BoxStickerSheet";
```

- [ ] **Step 2: Add box-count state and rename the staged-result state**

Replace the `lastSticker` state declaration (line 47):

```jsx
  const [lastSticker, setLastSticker] = useState(null);
```

with:

```jsx
  const [staged, setStaged] = useState(null);     // prepare response: { boxes, transactionNo, item }
  const [verifyBoxCount, setVerifyBoxCount] = useState(1);
```

- [ ] **Step 3: Reset the new state when opening the dialog**

In `openVerifyDialog` (lines ~98-106), replace `setLastSticker(null);` with:

```jsx
    setStaged(null);
    setVerifyBoxCount(1);
```

- [ ] **Step 4: Send boxCount from the stage handler and store the staged result**

In `handleVerify` (lines ~108-136), update the request body and the success branch. Replace:

```jsx
        body: JSON.stringify({
          inventoryId: selectedItem._id,
          actualQty: verifyQty,
          weightKg: verifyWeight === "" ? null : Number(verifyWeight),
          condition: verifyCondition,
          category: verifyCategory,
        }),
```

with:

```jsx
        body: JSON.stringify({
          inventoryId: selectedItem._id,
          actualQty: verifyQty,
          weightKg: verifyWeight === "" ? null : Number(verifyWeight),
          condition: verifyCondition,
          category: verifyCategory,
          boxCount: verifyBoxCount,
        }),
```

and replace:

```jsx
      if (res.ok) {
        const data = await res.json();
        setLastSticker(data.sticker || null);
        await fetchData();
      } else {
```

with:

```jsx
      if (res.ok) {
        const data = await res.json();
        setStaged(data);
        await fetchData();
      } else {
```

- [ ] **Step 5: Add the confirm-print handler**

Immediately after `handleVerify` (after its closing `};`, ~line 136), add:

```jsx
  const handleConfirmPrint = useCallback(async () => {
    if (!selectedItem) return;
    try {
      const res = await apiFetch("/api/hub/confirm-print", {
        method: "POST",
        body: JSON.stringify({ inventoryId: selectedItem._id }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to confirm print");
        return;
      }
      await fetchData();
    } catch {
      alert("Failed to confirm print");
    }
  }, [apiFetch, selectedItem, fetchData]);
```

- [ ] **Step 6: Add a Box-count input to the verify form**

In the verify dialog form grid (the `grid sm:grid-cols-2 gap-4` block, after the Category field that ends ~line 486), add a new field before the closing `</div>` of the grid:

```jsx
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Number of boxes</label>
                  <input
                    type="number"
                    min="1"
                    value={verifyBoxCount}
                    onChange={(e) => setVerifyBoxCount(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={!!staged}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-60"
                  />
                </div>
```

- [ ] **Step 7: Replace the sticker/verify result block**

Replace the `{lastSticker ? ( … ) : ( … )}` block (lines ~489-524) with:

```jsx
              {staged ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-amber-700 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Staged. Click <strong>Print all</strong> to print every box and complete verification.
                  </p>
                  <BoxStickerSheet boxes={staged.boxes || []} onPrint={handleConfirmPrint} />
                  <Button
                    variant="outline"
                    onClick={() => { setVerifyDialog(false); setSelectedItem(null); setStaged(null); }}
                    className="w-full"
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleVerify}
                  disabled={actionLoading === selectedItem._id}
                  className="w-full gap-2"
                >
                  {actionLoading === selectedItem._id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Stage &amp; preview box stickers
                </Button>
              )}
```

- [ ] **Step 8: Add a "Finish printing" action for pending_print items**

In the incoming item card actions (the `flex gap-3 flex-wrap` block at lines ~358-372), replace the single Verify button:

```jsx
                    <Button onClick={() => openVerifyDialog(item)} className="gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Verify Item
                    </Button>
```

with a status-aware button:

```jsx
                    {item.status === "pending_print" ? (
                      <Button onClick={() => openVerifyDialog(item)} className="gap-2 bg-amber-600 hover:bg-amber-700">
                        <Clock className="w-4 h-4" />
                        Finish printing
                      </Button>
                    ) : (
                      <Button onClick={() => openVerifyDialog(item)} className="gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Verify Item
                      </Button>
                    )}
```

> `Clock` is already imported in this file (line 16).

- [ ] **Step 9: Manual verification (UI)**

Run `npm run dev`, log in as a hub with an `at_hub` item:
1. Verify → set **Number of boxes = 3** → **Stage & preview** → three stickers render, each showing the item name, per-box net weight (total ÷ 3), the same `TR-…`, and `BI-XXX0001/0002/0003`. The item still shows under incoming (now "Finish printing").
2. Click **Print all** → the print window opens AND the item moves to the verified inventory tab (confirm-print fired). Admin gets a notification.
3. Repeat but close the dialog right after staging (no Print) → item stays under incoming as "Finish printing"; **not** in verified inventory. Re-open → same boxes return (no duplicates).

- [ ] **Step 10: Commit**

```bash
git add client/pages/dashboards/HubDashboard.jsx
git commit -m "feat: hub box-count input, stage->print flow, pending-print resume"
```

---

## Task 11: Recycler dashboard — acknowledge boxes on receipt

**Files:**
- Modify: `client/pages/dashboards/RecyclerDashboard.jsx`

- [ ] **Step 1: Add state for box receipts**

In `RecyclerDashboard.jsx`, after the `deliveries` state (line 27), add:

```jsx
  const [boxGroups, setBoxGroups] = useState([]);
  const [ackBusy, setAckBusy] = useState(null); // boxId currently being acknowledged
  const [ackPaste, setAckPaste] = useState('');
```

- [ ] **Step 2: Load box receipts in `refresh`**

In the `refresh` callback (lines ~38-53), add `api.get('/api/recycler/boxes')` to the `Promise.all` and store it. Replace:

```jsx
      const [o, a, d, r] = await Promise.all([
        api.get('/api/recycler/orders'),
        api.get('/api/recycler/delivery-agents'),
        api.get('/api/recycler/deliveries'),
        api.get('/api/recycler/requests'),
      ]);
      setOrders(o?.items || []);
      setAgents(a?.agents || []);
      setDeliveries(d?.deliveries || []);
      setRequests(r?.requests || []);
```

with:

```jsx
      const [o, a, d, r, b] = await Promise.all([
        api.get('/api/recycler/orders'),
        api.get('/api/recycler/delivery-agents'),
        api.get('/api/recycler/deliveries'),
        api.get('/api/recycler/requests'),
        api.get('/api/recycler/boxes'),
      ]);
      setOrders(o?.items || []);
      setAgents(a?.agents || []);
      setDeliveries(d?.deliveries || []);
      setRequests(r?.requests || []);
      setBoxGroups(b?.items || []);
```

- [ ] **Step 3: Add the acknowledge handler**

After `submitRequest` (or any existing handler, before the `return (`), add:

```jsx
  const acknowledgeBox = async (qrPayload, boxId) => {
    setAckBusy(boxId || qrPayload);
    try {
      const res = await api.post('/api/recycler/acknowledge', { scannedQr: qrPayload });
      if (res?.complete) alert('All boxes acknowledged — item marked received.');
      await refresh();
    } catch (err) {
      alert(err?.message || 'Could not acknowledge this box.');
    } finally {
      setAckBusy(null);
    }
  };
```

> If `api.post` does not throw on non-2xx in this codebase, the call still resolves and `refresh()` will reflect the server state; the alert path is best-effort.

- [ ] **Step 4: Render the box-receipts section**

Locate the "Inbound deliveries" section (`<h2 className="text-xl font-bold mb-4">Inbound deliveries</h2>`, line ~295). Add this block immediately after that section's closing tag (before the dialogs near the end of the main content):

```jsx
        {boxGroups.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-bold mb-1">Acknowledge receipt — scan boxes</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Scan each box's QR (or tap Confirm) as it arrives. The item is marked received once every box is acknowledged.
            </p>

            <div className="mb-4 flex gap-2 max-w-md">
              <input
                value={ackPaste}
                onChange={(e) => setAckPaste(e.target.value)}
                placeholder="Paste a scanned box QR…"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
              <Button
                variant="outline"
                disabled={!ackPaste.trim() || !!ackBusy}
                onClick={() => { acknowledgeBox(ackPaste.trim()); setAckPaste(''); }}
              >
                Acknowledge
              </Button>
            </div>

            <div className="space-y-4">
              {boxGroups.map((g) => (
                <div key={g.inventoryId} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{g.itemName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{g.transactionNo}</p>
                    </div>
                    <span className={`text-sm font-semibold ${g.acknowledged === g.total ? 'text-green-600' : 'text-amber-600'}`}>
                      {g.acknowledged} / {g.total} acknowledged
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {g.boxes.map((b) => (
                      <div key={b.boxId} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-mono font-semibold truncate">{b.boxId}</p>
                          <p className="text-xs text-muted-foreground">
                            Box {b.boxSeq} of {b.boxCount}
                            {b.netWeightKg != null ? ` · ${b.netWeightKg} kg` : ''}
                          </p>
                        </div>
                        {b.status === 'acknowledged' ? (
                          <span className="text-green-600 inline-flex items-center gap-1 text-sm">
                            <Check className="w-4 h-4" /> Done
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={ackBusy === b.boxId}
                            onClick={() => acknowledgeBox(b.qrPayload, b.boxId)}
                          >
                            {ackBusy === b.boxId ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Scan / Confirm'}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
```

> `Button`, `Check`, and `Loader2` are already imported in this file (lines 4 and 7).

- [ ] **Step 5: Manual verification (UI)**

Run `npm run dev`. As a recycler with a `delivered` item that has printed boxes:
1. The "Acknowledge receipt — scan boxes" section lists the item with `0 / N acknowledged`.
2. Tap **Scan / Confirm** on each box → the counter increments, the box shows **Done**, and on the last box an alert confirms the item is received.
3. The paste field also works: paste a box's QR string and click **Acknowledge**.
4. Pasting a random/invalid string shows the server's "Invalid or unrecognised QR code." error and does not change counts.

- [ ] **Step 6: Commit**

```bash
git add client/pages/dashboards/RecyclerDashboard.jsx
git commit -m "feat: recycler scan-to-acknowledge box receipts UI"
```

---

## Task 12: Full-flow verification + final commit

- [ ] **Step 1: Run the unit suite**

Run: `npm test`
Expected: all `boxCodes.test.js` and `schemas.test.js` tests PASS, no failures.

- [ ] **Step 2: End-to-end manual walkthrough**

With `npm run dev` running, exercise the whole chain:
1. **Hub:** verify an `at_hub` item with Box count = 2 → Stage → Print all → item `verified`, 2 boxes `printed`.
2. **Admin → recycler:** assign the verified item to a recycler (existing admin flow).
3. **Recycler:** assign a delivery worker (existing flow).
4. **Delivery worker:** pickup then dropoff → item `delivered`.
5. **Recycler:** open "Acknowledge receipt", confirm both boxes → `2 / 2 acknowledged`, item gains `received_at_recycler`.
6. Restart the server (`npm run dev`) → confirm boxes persisted (the receipts still show acknowledged), proving the pgStore round-trip.

Expected: each step transitions state as described; nothing reaches `verified` without a Print click.

- [ ] **Step 3: Final commit (if any stray changes)**

```bash
git add -A
git commit -m "chore: hub box QR transactions feature complete" || echo "nothing to commit"
```

---

## Self-review

**Spec coverage:**
- TR-YYYYMMDDHHMMSS per transaction → Task 1 (`generateTransactionNo`), used in Task 7.
- BI-XXX0001, same prefix per transaction, sequence per box → Task 1 (`generateBoxPrefix`/`makeBoxId`), Task 7.
- Sticker prints item name + net weight + TR; QR encodes TR + Box ID → Task 2 (payload), Task 9 (sticker), Task 3 (weight split).
- Table storing IDs + hub name + item name (+ recycler company) → Task 5 (`boxes` table), Tasks 7/8 populate it.
- Recycler acknowledges by scanning all boxes; records recycler company → Task 8 + Task 11.
- Not verified until Print clicked → Task 7 (prepare = `pending_print`, confirm-print = `verified`) + Task 10 UI.

**Placeholder scan:** No TBD/TODO; every code step contains full code; manual-verification steps give concrete expected outcomes.

**Type/name consistency:** Box object shape (`_id, transactionNo, inventoryId, qrPayload, itemName, netWeightKg, unit, boxSeq, boxCount, hubId, hubName, status, recyclerId, recyclerCompany, acknowledgedAt`) is identical across Task 5 (pgStore map), Task 7 (creation), Task 8 (reads). API response box shape (`boxId, transactionNo, qrPayload, itemName, netWeightKg, unit, boxSeq, boxCount, hubName`) matches `BoxStickerSheet` props (Task 9) and the hub dashboard (Task 10). `acknowledgeBox(qrPayload, boxId)` signature matches its call sites. `verifyBoxQr` returns `{ transactionNo, boxId }` consistently (Task 2 ↔ Task 8).
