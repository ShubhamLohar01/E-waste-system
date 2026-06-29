# Monetary Payout & Valuation System — Design

- **Date:** 2026-06-29
- **Status:** Approved for planning
- **Replaces:** the gamification reward engine (points-per-kg, badges, milestones, tiers)

---

## 1. Summary

Replace the abstract "points" gamification with a **real-money payout system**. When a
recycler buys a received item, the system values it from an **admin-maintained current-market
price catalog** scaled by the **technician's 1–10 quality grade**, then splits the resulting
pool between the seller (small user), the platform, and the hub. The hub separately records
what it pays the collector. Delivery agents are the recycler's own staff and are not tracked.

"Points" is retired as a concept; the only ledger is in **rupees (₹)**, where the legacy
"1 point = ₹1" phrasing simply means ledger amounts are rupees.

---

## 2. Goals / Non-goals

**Goals**
- Value each item as `X = catalogValue(category) × gradePercent(grade)`.
- Split `X` as **user 60% / platform 20% / hub 20%**.
- Let the **hub record a collector payment** (hub-decided amount) into the ledger.
- Give admin a UI to maintain the **category price catalog**.
- Replace all gamification (badges/milestones/points-per-kg) and the delivery `earnings`
  endpoint with money views.

**Non-goals (v1)**
- Per-model / per-brand catalog granularity (v1 is per-**category**; model-level is future).
- Bulk-quantity bonus and age-depreciation multipliers (dropped — current market value
  already encodes both).
- Tracking delivery-agent pay (off-system by design).
- Bulk-generator payouts (v1 covers the small-user source flow; bulk is future).

---

## 3. Valuation

### 3.1 Price catalog (base `P`)
Admin maintains a current-market value per category — the resale value of a **good-condition**
unit. This is the base `P`. The user-entered original purchase price (and any invoice) is kept
only as **evidence/context**; it is never the payout base.

### 3.2 Grade → percent table
The recycler's technician grades the item **1–10** (already captured as
`inventory.quality_rating` + `technician_name`). A fixed, code-config table maps grade → % of `P`:

| Grade | % of P |
|-------|--------|
| 9–10  | 50%    |
| 7–8   | 40%    |
| 5–6   | 28%    |
| 3–4   | 15%    |
| 1–2   | 8% (floor) |

`gradePercent(grade)` returns the band's percent. Stored as a constant in the valuation
service (`server/services/payoutEngine.js`); admin-editable tables are a future enhancement.

### 3.3 Pool
```
X = round( catalogValue(category) × gradePercent(grade) )
```
Worked example: Mobile, P = ₹1,000, grade 10 → X = ₹500.

---

## 4. Split + collector ledger

### 4.1 The 60/20/20 split of `X`
- **user (sourceUserId): 60%**
- **platform: 20%**
- **hub (hubId): 20%**

Rounding rule (so the parts always sum to `X`):
```
userShare     = round(X × 0.60)
platformShare = round(X × 0.20)
hubShare      = X − userShare − platformShare   // remainder absorbs rounding
```
Example: X = ₹500 → user ₹300, platform ₹100, hub ₹100.

**Economic note (accepted):** at grade-10 (50%) and user-60%, the seller nets **30% of current
market value**. This is intentional given the hub + platform + collector all draw from the same
sale. Tunable via the grade table and the split constants.

### 4.2 Hub → collector
The collector who delivered the item to the hub (`inventory.collectorId`) is paid an amount the
**hub decides** (no formula). The hub records it; it becomes a ledger entry of type
`collector_payment` with `decidedBy = hubId`. The amount is in rupees ("1 pt = ₹1").

### 4.3 Delivery agent
Recycler's own staff, paid off-system. **Nothing recorded.**

---

## 5. Data model

### 5.1 New table `category_prices`
```sql
create table if not exists category_prices (
  category      text primary key,
  current_value numeric not null,
  updated_by    text references users(id),
  updated_at    timestamptz default now()
);
```

### 5.2 New table `earnings_ledger`
```sql
create table if not exists earnings_ledger (
  id           text primary key,            -- LE-XXXXXXX
  user_id      text references users(id),   -- null for platform_share
  role         text,                        -- small_user | hub | platform | local_collector
  inventory_id text references inventory(id),
  amount_rs    numeric not null,
  type         text not null,               -- user_share | hub_share | platform_share | collector_payment
  decided_by   text references users(id),   -- admin (split) or hub (collector_payment)
  note         text,
  created_at   timestamptz default now()
);
create index if not exists idx_earnings_user      on earnings_ledger(user_id);
create index if not exists idx_earnings_inventory  on earnings_ledger(inventory_id);
```
A user's **balance is derived** by summing `amount_rs` for their `user_id` (data volumes are
small; matches the in-memory model pattern). No separate wallet table.

### 5.3 `inventory` additive columns
```sql
alter table inventory add column if not exists assessed_value numeric;  -- X, frozen at payment
alter table inventory add column if not exists original_price numeric;  -- user evidence (optional)
```
`quality_rating` and `technician_name` already exist.

### 5.4 Legacy `rewards`
The `rewards` table and `RewardEngine` are **removed from the flow** (no longer read or written).
The physical table is left in place (not dropped) to avoid data loss; it can be dropped later.

### 5.5 Wiring
- New models: `server/models/CategoryPrice.js`, `server/models/EarningsLedger.js` (in-memory arrays).
- `pgStore.js`: add both tables to `TABLES` (columns / fromRow / toRow); `ensureSchema()` adds the
  two `inventory` columns and `create table if not exists` for the two new tables (kept inline so
  it works in the bundled prod build).
- `idGenerator.js`: add `PREFIX.LEDGER = 'LE'`.

---

## 6. Valuation service

New `server/services/payoutEngine.js`, replacing `rewardEngine.js`:
- `GRADE_BANDS` and `gradePercent(grade)`.
- `SPLIT = { user: 0.6, platform: 0.2, hub: 0.2 }`.
- `computePool(category, grade)` → `X` (reads catalog; throws if no catalog price / no grade).
- `recordSale(item, decidedBy)` → writes `user_share`, `platform_share`, `hub_share` ledger
  entries and freezes `item.assessed_value = X`. Idempotent per item (no double payout).
- `recordCollectorPayment(collectorId, inventoryId, amountRs, hubId)` → one `collector_payment` entry.
- `balanceFor(userId)` and `ledgerFor(userId)` helpers.

---

## 7. API changes

**New**
- `GET  /api/admin/category-prices` — list catalog.
- `PUT  /api/admin/category-prices` — upsert `{ category, currentValue }` (admin only).
- `GET  /api/earnings/mine` — `{ balanceRs, entries[] }` for the logged-in user (any role).
- `POST /api/hub/collector-payment` — body `{ inventoryId, amountRs }`; hub-only; creates a
  `collector_payment` entry for that item's collector.

**Changed**
- Admin payment route (currently sets item `processed` and calls `awardTripleOnProcessed`):
  the payment **amount is the system-computed `X`** (no longer free-entered by admin — it is
  derived from catalog × grade, shown for confirmation). On confirm, the route sets the item
  `processed`, calls `recordSale`, and creates the 60/20/20 ledger entries.
  Preconditions: item is graded (`quality_rating` set) **and** its category has a catalog price;
  otherwise return `409` with a clear message ("set a catalog price for <category>" / "item not
  graded yet"). The legacy `markPaymentSchema.amount` field is dropped from the request.

**Removed**
- `GET /api/delivery/earnings`.
- `GET /api/rewards/mine`, `GET /api/intent/rewards`, and the `rewards` route/engine.

---

## 8. UI changes

- **AdminDashboard:** a **Category Prices** panel (list categories with current value, inline
  edit/save). Payment recording shows the **computed `X` and the 60/20/20 breakdown** before
  confirming.
- **SmallUserDashboard:** replace the coins/badges/milestones rewards section (and the `/reward`
  wallet link) with an **Earnings** view: balance + a table of `user_share` payouts per item.
- **HubDashboard:** show **hub earnings** (balance + entries); add a **"Record collector payment"**
  action on received/processed items (pick amount → posts to `/api/hub/collector-payment`).
- **LocalCollectorDashboard:** show **collector earnings** (balance + `collector_payment` entries).
- **DeliveryWorkerDashboard:** remove the earnings section.

(The Hub and Collector points badges were already removed in prior work; they are replaced by the
money earnings views here.)

---

## 9. Edge cases & rules

- **No catalog price** for a category → payment blocked (409) until admin sets it.
- **Item not graded** at payment time → blocked (409). Grading happens at recycler receipt, before
  payment, so this is the exception path.
- **Idempotency:** `recordSale` runs once per item; re-recording payment must not duplicate ledger
  entries (guard on existing `assessed_value` / existing `user_share` entry for the item).
- **Rounding:** `X` and shares rounded to whole rupees; hub absorbs the remainder (§4.1).
- **Platform share:** stored with `role = 'platform'`, `user_id = null`; surfaced only to admin as
  total platform revenue.
- **Missing collector:** if an item has no `collectorId`, the hub simply has no one to pay (action
  hidden/disabled).

---

## 10. Build phases

1. **Catalog**: `category_prices` table + model + pgStore wiring + admin list/upsert API + admin UI.
2. **Valuation & split**: `payoutEngine`, `earnings_ledger`, inventory columns, wire into the admin
   payment route (replace `awardTripleOnProcessed`), `GET /api/earnings/mine`; remove the reward
   engine/routes; SmallUser earnings view.
3. **Collector ledger & cleanup**: `POST /api/hub/collector-payment` + hub action UI, collector &
   hub earnings views, remove `/api/delivery/earnings` and the delivery earnings UI.

Phases are sequential; each is independently shippable and testable.

---

## 11. Open questions

None blocking. Future enhancements: model-level catalog granularity, admin-editable grade bands,
and bulk-generator payouts.
