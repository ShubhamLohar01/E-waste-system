# Hub box QR transactions — design

**Date:** 2026-06-26
**Status:** Approved (design); pending implementation plan

## Problem

When a hub verifies an item it currently generates one QR per physical *unit* and
marks the item `verified` in the same request — printing is optional. We want a
**box-based** model instead:

- A hub packs one verified item into **N physical boxes** and prints a sticker per box.
- Each print is one **transaction** identified by `TR-YYYYMMDDHHMMSS`.
- Each box has a **Box ID** `BI-XXX0001` (XXX = 3 random letters, same for all boxes
  of the transaction; the 4-digit suffix is the box sequence within the item).
- The printed sticker shows: **item name, net weight (per box), transaction number**,
  plus the QR image. Scanning the QR yields **transaction number + Box ID**.
- A **table** stores box IDs with the generating hub's name and the item name.
- The recycler **acknowledges receipt by scanning every box QR**; the recycler company
  is recorded on each box.
- **An item only becomes `verified` when the hub clicks Print.** No print → not verified.

## Key decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Transaction scope | **1 item → N boxes.** Hub enters box count; one print = one transaction → N box IDs. |
| Box ID prefix | **Same 3 random letters per transaction;** only the numeric suffix increments. |
| Net weight on sticker | **Total item weight ÷ box count** (computed; remainder added to the last box so per-box weights sum to the total). |
| Recycler acknowledgment | **At delivery receipt, scan all boxes.** Recycler company recorded per box; item fully acknowledged only when every box is scanned. |
| Print gating | **Approach A — Prepare → Print.** Boxes are created at prepare (`pending_print`) so the hub previews real stickers; clicking Print flips the item to `verified` and boxes to `printed`. |

## Architecture context

The server keeps in-memory model arrays (e.g. `inventory = []`) mutated by routes;
`server/lib/pgStore.js` hydrates them from Postgres at boot and rewrites whole tables
on each write (coalesced via `persistAll` middleware). Readable IDs come from
`server/utils/idGenerator.js`. QR strings are HMAC-signed in `server/utils/helpers.js`.
A new table therefore touches: `schema.sql`, `migrate.mjs`, `pgStore.js` (TABLES),
a new model array, and `idGenerator.js`.

## Data model — new `boxes` table

One row per physical box.

| column | type | example | notes |
|---|---|---|---|
| `id` (PK) | text | `BI-ABC0001` | `BI-` + 3 random A–Z (same per transaction) + 4-digit box sequence |
| `transaction_no` | text | `TR-20260626143000` | `TR-YYYYMMDDHHMMSS`; shared by all boxes of the item |
| `inventory_id` (FK → inventory) | text | `ITEM-2606001` | the item this box belongs to |
| `qr_payload` (unique) | text | `BOX.TR-….BI-….a1b2c3d4e5f6` | HMAC-signed string encoded in the QR image |
| `item_name` | text | `Laptops` | snapshot at print time |
| `net_weight_kg` | numeric | `4` | total item weight ÷ box count (remainder on last box) |
| `unit` | text | `pieces` | snapshot |
| `box_seq` | integer | `1` | 1..N |
| `box_count` | integer | `3` | N — for "Box 1 of 3" |
| `hub_id` (FK → users) | text | | generating hub |
| `hub_name` | text | `Andheri Hub` | snapshot |
| `status` | text | `pending_print` | `pending_print` → `printed` → `acknowledged` |
| `recycler_id` (FK → users) | text | | set on acknowledgment |
| `recycler_company` | text | `GreenLoop Recyclers` | snapshot of recycler name on acknowledgment |
| `acknowledged_at` | timestamptz | | |
| `created_at` | timestamptz | default `now()` | |
| `updated_at` | timestamptz | default `now()` | |

Indexes: `idx_boxes_inventory (inventory_id)`, `idx_boxes_recycler (recycler_id)`,
`idx_boxes_transaction (transaction_no)`.

In-memory shape (camelCase, `_id`): `{ _id, transactionNo, inventoryId, qrPayload,
itemName, netWeightKg, unit, boxSeq, boxCount, hubId, hubName, status, recyclerId,
recyclerCompany, acknowledgedAt, createdAt, updatedAt }`.

## ID + QR generation — new `server/utils/boxCodes.js`

- `generateTransactionNo()` → `TR-YYYYMMDDHHMMSS`. On the rare same-second collision
  with an existing transaction, append `-2`, `-3`, … to stay unique.
- `generateBoxPrefix(existingBoxIds)` → 3 random uppercase letters, retried until
  `BI-XXX0001` is not already taken (guarantees the PK is free).
- `makeBoxId(prefix, seq)` → `BI-${prefix}${String(seq).padStart(4, '0')}`.
- `boxQrPayload(transactionNo, boxId)` → `BOX.<transactionNo>.<boxId>.<sig12>`,
  signed with `JWT_SECRET` using the same HMAC pattern as `helpers.generateQRCode`.
- `verifyBoxQr(payload)` → `{ transactionNo, boxId }` when the signature is valid,
  else `null`. Used when the recycler scans.

Box IDs are produced entirely by `boxCodes.js` (not the generic `nextId`), so
`idGenerator.js` is **not** touched. `generateBoxPrefix` receives the current boxes
array from the route to check Box ID uniqueness.

## Net-weight split

`perBox = floor(total / count * 100) / 100` for boxes 1..N-1; the last box gets
`total - perBox * (count - 1)` so the per-box weights sum exactly to the total.
If the hub left weight blank, net weight is omitted on the sticker and stored null.

## Hub flow

### 1. `POST /api/hub/verify` (prepare)
- `hubVerifySchema` gains `boxCount: integer >= 1`.
- Records `actualQty`, `weightKg`, `condition`, `category`, photos (as today), sets the
  item status to **`pending_print`** (not `verified`).
- Generates one `transaction_no` and N box rows (`pending_print`) with per-box weight,
  snapshots of item name / hub name, and signed `qr_payload`.
- **Idempotent on re-open:** if the item is already `pending_print` with boxes, returns
  the existing boxes instead of creating duplicates (regenerates only if `boxCount` changed
  and none are printed yet).
- Returns the box stickers for preview. **Does not notify admins.**

### 2. `POST /api/hub/confirm-print`
- Body `{ inventoryId }`.
- Item → **`verified`**; its boxes → **`printed`**; adds a `verified_at_hub` traceability
  entry; notifies admins ("verified batch ready"). **This is the only path to `verified`.**

### 3. Client (`HubDashboard.jsx`, new `BoxStickerSheet.jsx`)
- Verify dialog gains a **Box count** input.
- The sticker step renders a new **`BoxStickerSheet`** (per box: item name, net weight,
  TR number, Box ID, "Box i of N", hub name, QR image). Its **Print all** button calls
  `confirm-print`, then `window.print()`.
- A **Pending print** section lists `pending_print` items so the hub can resume and print
  later. The current per-unit `QRStickerSheet` is no longer used in the hub flow.
- The item-level `inventory.qr_code` is untouched (still used by the delivery manifest).

## Recycler acknowledgment

After a delivery reaches `delivered`:

### `GET /api/recycler/boxes`
Boxes belonging to the recycler's delivered items, grouped by item, with acknowledgment
progress (`acknowledged` / `total` per item).

### `POST /api/recycler/acknowledge`
- Body `{ scannedQr }`.
- `verifyBoxQr` the payload; reject invalid signatures.
- Look up the box by `boxId`; confirm its `inventory_id` is assigned to this recycler
  (`inventory.recyclerId === req.user.id`) and the item is `delivered`.
- Set `recycler_id`, `recycler_company` (= the recycler user's name), `acknowledged_at`;
  box → `acknowledged`. Idempotent if already acknowledged by this recycler.
- When **all** boxes of the item are acknowledged, add an item traceability entry
  (`received_at_recycler`) marking full receipt.
- Returns `{ acknowledged, total }` progress for the item.

### Client (`RecyclerDashboard.jsx`)
An "Acknowledge receipt — scan boxes" panel showing each delivered item's boxes and
scan progress; completes only when every box of the item is scanned.

## Files touched

**Server**
- `server/db/schema.sql` — add `boxes` table + indexes.
- `server/db/migrate.mjs` — add `boxes` column map.
- `server/lib/pgStore.js` — add `boxes` to `TABLES` (parent of nothing; after `inventory`).
- `server/models/Box.js` — new in-memory array.
- `server/utils/boxCodes.js` — new: TR / Box ID / QR payload generation + verify.
- `server/routes/hub.js` — split verify into prepare + `confirm-print`; box generation.
- `server/routes/recycler.js` — `GET /boxes`, `POST /acknowledge`.
- `server/schemas.js` — `boxCount` on `hubVerifySchema`; `confirmPrintSchema`, `acknowledgeBoxSchema`.

**Client**
- `client/components/BoxStickerSheet.jsx` — new box sticker + print.
- `client/pages/dashboards/HubDashboard.jsx` — box count input, prepare→print, pending-print list.
- `client/pages/dashboards/RecyclerDashboard.jsx` — box acknowledgment scan UI.

## Out of scope
- Delivery-worker pickup/dropoff scanning stays on the item-level `qr_code`.
- Admin payment flow unchanged.
- No true print-completion guarantee: "clicked Print" is trusted as the verification signal.

## Assumptions
- The recycler user's `name` is the company name recorded as `recycler_company`.
- Box prefix space (26³ = 17,576) is ample; the retry-until-free loop guarantees PK uniqueness.
- Per-unit QR stickers are fully replaced by box stickers in the hub flow (not kept in parallel).
