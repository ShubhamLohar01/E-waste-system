# E-Waste Management System — Project Overview

> Generated after a full code walkthrough of `client/`, `server/`, `shared/`, `seed.js`, and `guide.md`. Every claim below is traceable to a file.

---

## 1. What this project actually is

A **full-stack web app** (React 18 SPA + Express 5 API on a single port) that coordinates the **pickup, verification, transport, and recycling of electronic waste**, stitching together seven distinct actor roles and rewarding small contributors with loyalty points.

Despite the owner calling it a **"tokenisation system"**, there is **no blockchain, no ERC-20, no smart contract, no wallet address** anywhere in the codebase. What exists is an integer-point ledger stored in a plain JavaScript `Reward[]` array. It is a **gamification / loyalty engine**, not a token economy. See `server/models/Reward.js` and `server/services/rewardEngine.js:170-196` — benefits returned for tiers are "priority pickup scheduling", "20% discount on partner services", "community recognition". No mint, no transfer, no on-chain anything.

Tech summary:

| Layer          | Stack                                                                      |
|----------------|-----------------------------------------------------------------------------|
| Frontend       | React 18, React Router 6, Vite, TailwindCSS 3, Radix UI, @tanstack/react-query |
| Backend        | Express 5, JWT (`jsonwebtoken`), bcrypt, nodemailer, qrcode, zod (unused)  |
| Data           | **In-memory JS arrays** — re-seeded on every restart via `server/seed.js`   |
| Shared         | `shared/api.js` (empty — was TS-only types before the JS conversion)        |
| Dev / build    | Single port 8080, Vite + Express integrated, `pnpm dev` / `pnpm build`      |

Recent git history shows the repo was **converted from TypeScript → JavaScript** (`f50f178`) and had decorative UI stripped (`1c67cf2`). Several leftovers from that conversion are still visible (empty `shared/api.js`, `README.md` still mentions TypeScript/Vitest, `zod` in `package.json` but never imported).

---

## 2. Motive & intent — what is this trying to achieve?

Reading the data models + routes + `guide.md`, the system is aimed at **four goals simultaneously**:

1. **Formal e-waste supply-chain traceability.** Every physical item becomes an `Inventory` record with a unique QR string (`server/utils/helpers.js:28`) and an append-only `traceability[]` log that records each actor touch (collector → hub → delivery → recycler). The `/api/admin/audit` endpoint e xposes that chain. This is the shape of a **compliance / EPR (Extended Producer Responsibility) reporting** tool.
2. **Gamified citizen participation.** Small users donate household e-waste and, in theory, earn points → badges → tier benefits to encourage repeat contributions. The intent is to plug the informal household-to-kabadiwala gap with a tracked, incentivised alternative.
3. **Logistics middleware (supply ↔ demand matching).** Recyclers post `Demand` records ("I need 500 kg of laptops in the next 2 weeks"), and a `matchingEngine` pairs those demands against verified hub inventory, then dispatches a `Delivery`. Conceptually this is "Uber for reverse-logistics of e-waste".
4. **Trust stratification via role separation.** Low-trust roles (small_user, collector) declare quantities; high-trust roles (hub) verify them; admin arbitrates disputes. No one actor can fabricate the ledger alone.

**Real-world applicability:** Formal e-waste collection networks in regulated environments (municipal programs, corporate disposal, EPR compliance for OEMs). In its current state the app is a solid demo / prototype but **not production-ready** (see `GAPS_AND_LOOPHOLES.md`).

---

## 3. The seven roles

| Role              | Capability                                                                                     | Dashboard status       |
|-------------------|-------------------------------------------------------------------------------------------------|------------------------|
| `small_user`      | Submit disposal intents, track pickups, view reward wallet                                      | ✅ Fully wired          |
| `local_collector` | See pending pickups, accept, collect (photo proof), drop at hub                                 | ✅ Fully wired          |
| `hub`             | Receive from collectors, verify actual qty/condition, flag discrepancies, maintain inventory   | ✅ Fully wired          |
| `delivery_worker` | Transport verified inventory hub → recycler with QR proofs                                      | ❌ **Placeholder only** |
| `recycler`        | Post demand, receive & confirm shipments, report processing outcome                             | ❌ **Placeholder only** |
| `bulk_generator`  | Fast-track large-volume corporate e-waste with compliance certificates                          | ❌ **Placeholder only** |
| `admin`           | System oversight, manual assignments, trigger matching, resolve disputes, audit log             | ⚠️ UI scaffolded, **mostly mock data; buttons not wired** (`client/pages/dashboards/AdminDashboard.jsx:15-96`) |

Roles are declared on the `User` document (`server/models/User.js`) and gated in two places:
- **Frontend:** `ProtectedRoute` in `client/App.jsx:35-108`.
- **Backend:** `requireRole()` middleware (`server/middleware/auth.js:34-46`) applied per route.

---

## 4. Data model at a glance

All seven models live as in-memory arrays (`server/models/*.js`). Data is cleared on startup by `server/seed.js:18-24` and re-seeded with demo records.

| Model       | Key fields                                                                                                | Lifecycle                                          |
|-------------|------------------------------------------------------------------------------------------------------------|-----------------------------------------------------|
| `User`      | `_id, name, email, password (bcrypt), phone, role, trustLevel, location, isActive`                        | created → active / deactivated                      |
| `Intent`    | `_id, userId, type (small_user \| bulk_generator), items[], status, location, assignedCollector`          | submitted → assigned → collected                    |
| `Inventory` | `_id, qrCode, intentId, category, actualQty, unit, condition, status, sourceUserId, collectorId, hubId, deliveryWorkerId, recyclerId, verificationPhotos[], traceability[]` | submitted → assigned → collected → at_hub → verified → matched → in_transit → delivered → processed (8 states) |
| `Demand`    | `_id, recyclerId, category, quantityNeeded, unit, deliveryWindow, status, matchedInventory[]`             | open → partially_matched / fully_matched → fulfilled |
| `Delivery`  | `_id, demandId, deliveryWorkerId, pickupHub, dropoffRecycler, manifest[], status, pickupProof, dropoffProof` | assigned → picked_up → delivered                   |
| `Reward`    | `_id, userId, totalPoints, currentStreak, badges[], milestones[], history[]`                              | created at signup — **never updated by any route** (see below) |
| `Dispute`   | `_id, raisedBy, against, deliveryId, type, description, evidence[], status, resolvedBy, resolution`       | open → resolved — **no endpoint to create one**     |

---

## 5. Core end-to-end flows

### 5.1 Small-user flow (the "happy path" — 12 steps)

```
1.  small_user  →  POST /api/intent                       (items + location)
                   ↳ creates Intent + Inventory items (status=submitted)
2.  collector   →  GET  /api/collector/pending
3.  collector   →  POST /api/collector/accept             (self-assigns)
                   ↳ Intent.status = assigned
4.  collector   →  POST /api/collector/collect            (photo required)
                   ↳ Inventory.status = collected, qrCode regenerated
5.  collector   →  POST /api/collector/hub-delivery       (picks hub)
                   ↳ Inventory.status = at_hub
6.  hub         →  POST /api/hub/verify                   (actualQty, condition, category)
                   ↳ Inventory.status = verified, hubVerifiedAt set
7.  recycler    →  POST /api/demand                       (what they need)
                   ↳ Demand.status = open
8.  admin       →  POST /api/admin/match
                   ↳ matchingEngine pairs verified items ↔ demand
                   ↳ Inventory.status = matched, Delivery created
9.  delivery    →  POST /api/delivery/:id/pickup          (photo)
                   ↳ Delivery.status = picked_up, Inventory.status = in_transit
10. delivery    →  POST /api/delivery/:id/dropoff         (photo)
                   ↳ Delivery.status = delivered
11. recycler    →  POST /api/demand/:id/confirm
                   ↳ Inventory.status = delivered, traceability logged
12. ❌ POINTS AWARD — NEVER HAPPENS
```

**Critical bug at step 12:** `RewardEngine.awardPoints()` and `awardCompletionPoints()` exist in [server/services/rewardEngine.js:31-66](../server/services/rewardEngine.js#L31-L66) but are **never called by any route**. A grep for `awardPoints` in `server/routes/` returns zero matches. Consequence: `totalPoints` stays at `0` for every small_user forever. The entire gamification core is dead code.

### 5.2 Bulk generator flow (fast-track)

```
bulk_user  →  POST /api/bulk/intent                → creates intent + inventory
hub        →  POST /api/hub/verify                 → status = verified
bulk_user  →  GET  /api/bulk/certificates          → returns "CERT-{intentId}" metadata
```

No collector step (bulk pickups skip aggregation). No actual PDF / signed compliance document is produced — just a string id (`server/routes/bulk.js:68-69`).

### 5.3 Matching flow (MatchingEngine)

[server/services/matchingEngine.js:14-83](../server/services/matchingEngine.js#L14-L83) does a naive filter: `inventory.category === demand.category && status === 'verified' && !matchedDemandId`, accumulates items until `quantityNeeded` is met, marks them `matched`. **Proximity / hub-distance scoring is declared but never used** — the code comment literally says "simplified — just take first available" (line 52). Delivery-worker assignment is `pool[idx % pool.length]` (line 129).

### 5.4 Reward flow

Defined in [server/services/rewardEngine.js](../server/services/rewardEngine.js):

- `calculatePoints(qty, unit)` → 1 pt/kg or 5 pts/piece, default 10
- `awardPoints(userId, inventoryId, qty, unit)` → increments `totalPoints` + pushes to `history[]`
- `checkAndAwardBadges()` → 6 tiers from "First Step" (100) → "Diamond Advocate" (10 000)
- `checkMilestones()` → marks milestone as reached
- `getBenefitsForTier()` → returns tier metadata (Silver / Gold / Platinum) with benefit strings
- `resetStreakIfNeeded()` → **never invoked** anywhere

None of these are called from any route. The `RewardWallet` page renders whatever the seed file put in, which is `0`.

### 5.5 Dispute flow

Admin-only: `GET /api/admin/disputes` and `PUT /api/admin/disputes/:id`. **No `POST /api/disputes`** for users to raise one (promised in `guide.md` §8, never implemented). Seed data includes one pre-made dispute.

### 5.6 QR flow

[server/utils/helpers.js:28-30](../server/utils/helpers.js#L28-L30) generates a plain string `QR-<timestamp>-<rand>`. There is no signature, no image rendered, no scanner verification — handlers accept `qrScanned: true` from the client without checking anything. The `qrcode` npm package is installed but never imported.

---

## 6. Auth & authorization

- **Registration / login:** `POST /api/auth/register`, `POST /api/auth/login`, plus email-OTP and Google OAuth paths.
- **Password hashing:** bcrypt with salt = 10 (`server/models/User.js`).
- **Session:** JWT signed for 7 days, stored in `localStorage` under key `auth_token` by [client/context/AuthContext.jsx:24](../client/context/AuthContext.jsx#L24). Every client request attaches `Authorization: Bearer <token>`.
- **Role guard:** `verifyAuth` + `requireRole()` in [server/middleware/auth.js](../server/middleware/auth.js).
- **Restore on refresh:** AuthContext calls `GET /api/auth/me` on mount.
- **No refresh token, no logout endpoint server-side, no password reset, no 2FA.**

---

## 7. API surface (42 endpoints)

Full table is in [CODE_REVIEW.md](./CODE_REVIEW.md#api-surface). Headlines:

- `/api/auth/*` — 8 endpoints (login, register, Google, email-OTP, profile)
- `/api/intent/*` — 5 (small-user intents + rewards + history + collected-waste)
- `/api/collector/*` — 8
- `/api/hub/*` — 4
- `/api/demand/*` — 5 (recycler side)
- `/api/delivery/*` — 4
- `/api/bulk/*` — 3
- `/api/admin/*` — 11 (oversight, match trigger, audit, config)

Three of these endpoints are **called by the client but only half-backed**: `/api/intent/rewards` returns 0s forever, `/api/admin/config` PUT is a stub (no persistence), `/api/bulk/certificates` returns a string id but nothing downloadable.

---

## 8. Frontend shape

- Routes declared in [client/App.jsx:35-108](../client/App.jsx#L35-L108). All dashboards wrapped in `<ProtectedRoute requiredRole=...>`.
- State: `@tanstack/react-query` is installed but **not used**; each dashboard has its own `useCallback(apiFetch)` wrapper and hand-rolled `useState`/`useEffect`. 30-second polling only in `SmallUserDashboard`.
- Styling: TailwindCSS 3 with HSL CSS variables in `client/global.css`; light mode only, no dark-mode toggle despite `next-themes` installed.
- Forms: no `react-hook-form` + `zod` anywhere — manual `alert()` calls for validation.
- `components/ui/` is the standard shadcn-style Radix library; largely fine.

Critical frontend issues:
- **Three dashboards** (delivery_worker, recycler, bulk_generator) are literal placeholders rendering a `DashboardPlaceholder` with a "planned features" list.
- **Admin dashboard** metrics are hardcoded ("12,847", "3,256"), tool buttons have no `onClick`, and the logout button is dead (`client/pages/dashboards/AdminDashboard.jsx:48`).
- No global error boundary, no toast-based error handler (Sonner is imported but never used for errors).

---

## 9. Current project health, at a glance

| Area                        | Status     | Notes                                                                 |
|-----------------------------|------------|-----------------------------------------------------------------------|
| Auth & JWT                  | ✅ OK      | Solid, missing rate limit & default-secret hardening                  |
| RBAC                        | ✅ OK      | Cleanly enforced on every route                                       |
| Data models                 | ⚠️ Partial | In-memory only; wiped on restart                                      |
| Small-user → hub flow       | ✅ OK      |                                                                       |
| Delivery & recycler flows   | ⚠️ Partial | Server works, client dashboards are placeholders                      |
| Matching engine             | ⚠️ Partial | Works for category match only; no proximity / reliability scoring     |
| Reward engine               | ❌ Dead    | Implemented in full, **never invoked** — points are always 0          |
| QR verification             | ⚠️ Partial | String only, no image, no signature                                   |
| Dispute system              | ⚠️ Partial | Admin side only — no creation endpoint                                |
| Persistence                 | ❌ Missing | `seed.js` clears arrays on every boot                                 |
| Input validation            | ❌ Missing | `zod` in deps, 0 schemas wired                                        |
| Rate limiting               | ❌ Missing | Brute-force surface open                                              |
| Tests                       | ❌ Minimal | Only `client/lib/utils.spec.js`                                       |
| CI / monitoring             | ❌ Missing |                                                                       |

See [GAPS_AND_LOOPHOLES.md](./GAPS_AND_LOOPHOLES.md) for the prioritised fix list, and [CODE_REVIEW.md](./CODE_REVIEW.md) for file-by-file findings.
