# Code Review — E-Waste Management System

> A file-by-file and module-by-module review. For the "what / why / how it flows" narrative see [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md). For the prioritised fix list see [GAPS_AND_LOOPHOLES.md](./GAPS_AND_LOOPHOLES.md).

## Table of contents

1. [Backend — server](#1-backend--server)
   1. [Bootstrap & middleware](#11-bootstrap--middleware)
   2. [Models](#12-models)
   3. [Routes](#13-routes)
   4. [Services](#14-services)
   5. [Utils](#15-utils)
2. [Frontend — client](#2-frontend--client)
   1. [App shell](#21-app-shell)
   2. [Auth](#22-auth)
   3. [Dashboards](#23-dashboards)
   4. [Shared components](#24-shared-components)
3. [Shared / config / build](#3-shared--config--build)
4. [API surface](#api-surface)
5. [Client → server call matrix](#client--server-call-matrix)
6. [Strengths worth preserving](#strengths-worth-preserving)

---

## 1. Backend — server

### 1.1 Bootstrap & middleware

**[server/index.js](../server/index.js)**

- Clean monolithic mount: `app.use('/api/auth', authRoutes)` etc. Easy to follow.
- ⚠️ `app.use(cors())` — wildcard, see [GAPS §2.5](./GAPS_AND_LOOPHOLES.md#-25-cors-is-wide-open).
- ⚠️ `app.use(express.json({ limit: '10mb' }))` — 10 MB JSON limit because photos are shipped as base64 inside the body. Solve by moving uploads to S3 ([GAPS §4.4](./GAPS_AND_LOOPHOLES.md#-44-no-file--image-storage--photos-are-base64-inside-json)) then tighten this to 100 KB.
- ⚠️ No `helmet()`, no request logger, no global error handler. Errors thrown inside routes end up as Express default 500s with stack traces.
- ❌ No healthcheck (`/api/ping` exists but isn't really one — it reads an env var and returns it).
- ❌ No process-level `unhandledRejection` / `uncaughtException` hooks.
- ✅ `await seedDatabase()` runs before Express starts — good ordering.

**[server/middleware/auth.js](../server/middleware/auth.js)**

- ✅ `verifyAuth` extracts bearer token, decodes, attaches `req.user`.
- ✅ `requireRole(...roles)` cleanly returns a middleware; used on every protected route.
- 🔴 `JWT_SECRET ?? 'your-secret-key-change-in-production'` fallback. See [GAPS §2.1](./GAPS_AND_LOOPHOLES.md#-21-jwt_secret-falls-back-to-a-hardcoded-default).
- 🟡 Role read from JWT payload, not re-checked against DB on every request. That means a deactivated user can keep using their token until expiry. Add a `user.isActive` lookup in `verifyAuth`.
- 🟡 No logging of auth failures (for audit / anomaly detection).

---

### 1.2 Models

All models under `server/models/` are **plain JS arrays** exported from the module, seeded by `server/seed.js`. That's fine as a prototype pattern; it's not a database. None of these files have validation, indexing, or any guarantee against concurrent mutation.

| File                          | Shape                                                                                                                       | Notes |
|-------------------------------|------------------------------------------------------------------------------------------------------------------------------|-------|
| **User.js**                   | `_id, name, email, passwordHash, phone, role, trustLevel, location{lat,lng,address}, isActive, createdAt`                   | `comparePassword` helper is fine; email uniqueness enforced only inside handlers, not at model level. |
| **Intent.js**                 | `_id, userId, type(small_user \| bulk_generator), items[{category,qty,unit,photos[],condition}], status, location, assignedCollector, createdAt` | 3-state lifecycle: `submitted → assigned → collected`. |
| **Inventory.js**              | `_id, qrCode, intentId, category, actualQty, unit, condition, status, sourceUserId, collectorId, hubId, deliveryWorkerId, recyclerId, matchedDemandId, verificationPhotos[], traceability[]` | The central entity. 8-state lifecycle. `qrCode` is regenerated on collect; regeneration invalidates any prior printed label. |
| **Demand.js**                 | `_id, recyclerId, category, quantityNeeded, unit, deliveryWindow{start,end}, status, matchedInventory[]`                   | No check that `deliveryWindow.start < end`. |
| **Delivery.js**               | `_id, demandId, deliveryWorkerId, pickupHub, dropoffRecycler, manifest[], status, pickupProof{photo, timestamp, qrScanned}, dropoffProof{}` | `qrScanned: true` is taken at face value — see [GAPS §2.6](./GAPS_AND_LOOPHOLES.md#-26-qr-codes-are-unsigned-plaintext). |
| **Reward.js**                 | `_id, userId, totalPoints, currentStreak, lastActivityAt, badges[], milestones[], history[]`                                | Shape is good; only issue is nobody writes to it after seeding ([GAPS §1.1](./GAPS_AND_LOOPHOLES.md#-11-reward-points-are-never-awarded--the-entire-gamification-loop-is-dead)). |
| **Dispute.js**                | `_id, raisedBy, against, deliveryId?, type, description, evidence[], status(open\|resolved), resolvedBy, resolution, createdAt` | No `POST` creates these — only the seeded dispute and `PUT /resolve`. |

🟡 **Cross-model inconsistency:** `Intent.items[].qty` vs. `Inventory.actualQty` — same semantic concept named differently, no helper function to convert between them. Hub-verify handler silently mutates `actualQty` without recording the original claimed qty, losing forensic data.

🟡 **Traceability is mutable.** `inventory.traceability[]` is just an array, can be re-ordered / truncated by any code with a reference to the array. Once persisted to a real DB, make sure the entry rows are in a separate, append-only collection.

---

### 1.3 Routes

> Full endpoint table below in [API surface](#api-surface). Findings per file:

**[server/routes/auth.js](../server/routes/auth.js)**
- 🔴 `POST /register` accepts arbitrary `role` from body — role spoofing ([GAPS §2.3](./GAPS_AND_LOOPHOLES.md#-23-role-spoofing-via-apiauthregister)).
- 🟠 `POST /login` has no rate limit — brute force ([GAPS §2.4](./GAPS_AND_LOOPHOLES.md#-24-no-rate-limiting-anywhere)).
- 🟠 `POST /google` verifies id_token by raw fetch to `tokeninfo` without explicit `aud` check ([GAPS §2.8](./GAPS_AND_LOOPHOLES.md#-28-google-id_token-verified-via-raw-http-to-tokeninfo)).
- 🟠 `PUT /profile` — updates `name, phone, location`; fine. Does not block email/role changes — good, but the implementation should be explicit about that.
- 🟡 Two parallel registration paths (`/register`, `/register-with-email`) duplicate validation and password hashing. Factor into a shared `createUser()` helper.
- ✅ bcrypt, signed JWT, 7-day expiry are all standard and correct.

**[server/routes/intent.js](../server/routes/intent.js)**
- ✅ `GET /:id` correctly restricts to owner or admin (line ~105).
- ⚠️ `GET /` returns **all** of the caller's intents with no pagination — fine now, not fine at 10 k rows.
- ⚠️ `/rewards` and `/history` live under `/api/intent/*` — semantically they're not about intents. Move to `/api/rewards/*` once you touch this file.
- ❌ `POST /` creates Inventory items but does not award placeholder points / create a reward entry (existing users have rewards from seed, but newly registered users won't unless you call `RewardEngine.initializeReward(userId)`).

**[server/routes/collector.js](../server/routes/collector.js)**
- ✅ Clean state machine: `/pending → /accept → /collect → /hub-delivery`.
- 🟡 `/collect` requires `photo` but does not size-check it.
- 🟡 `collectionId` generated (line ~125) but never stored/queried — see [GAPS §1.6](./GAPS_AND_LOOPHOLES.md#-16-collectionid-is-generated-but-orphaned).
- 🟡 `/hub-delivery` transitions items to `at_hub` without proof photo at destination; only the collect step has a photo.

**[server/routes/hub.js](../server/routes/hub.js)**
- ✅ Nice enrichment of incoming records with collector + user names.
- 🟡 `/verify` silently allows the hub to change `category` of an item (meaning the user's original claim can be overwritten without audit). Record original vs verified values separately.
- 🟡 `/flag` adds a line to `traceability[]` but does not change state. Either trigger a dispute automatically, or surface in admin dashboard.

**[server/routes/delivery.js](../server/routes/delivery.js)**
- 🟡 Earnings computed as `completedDeliveries.length * 100` (hardcoded $100 / delivery) — move to a config.
- 🟡 `/pickup` and `/dropoff` accept `photo` but no QR signature check.
- 🟡 `reliabilityScore` read but never calculated or stored.

**[server/routes/demand.js](../server/routes/demand.js)**
- 🟡 `/confirm` is the natural place to award reward points — currently it isn't. See [GAPS §1.1](./GAPS_AND_LOOPHOLES.md#-11-reward-points-are-never-awarded--the-entire-gamification-loop-is-dead).
- 🟡 Multiple mutations (Delivery + Inventory + Reward + traceability log) are not transactional.
- ⚠️ `deliveryWindow` is stored but not enforced — the recycler can "confirm" even if delivery is outside the window.

**[server/routes/bulk.js](../server/routes/bulk.js)**
- 🟡 `GET /certificates` returns `CERT-{intentId}` strings, not an actual PDF / signed doc. Fine as a placeholder; mark clearly in the UI.
- 🟡 No fast-track matching path — bulk items go through the same `MatchingEngine.findMatches()` as small-user items.

**[server/routes/admin.js](../server/routes/admin.js)**
- ✅ Good endpoint coverage for oversight (`/dashboard`, `/users`, `/disputes`, `/audit`, `/match`).
- 🟡 `PUT /config` is a stub — updates are not persisted. Remove or implement.
- 🟡 `PUT /disputes/:id` doesn't validate `resolution` length / format.
- 🟡 `POST /match` returns counts but no list of affected demand IDs — noisy for debugging.

**[server/routes/demo.js](../server/routes/demo.js)**
- Leftover from the "Fusion Starter" template. Safe to delete.

---

### 1.4 Services

**[server/services/matchingEngine.js](../server/services/matchingEngine.js)**
- ✅ `findMatches()` filter at line 25 is correct.
- ❌ `calculateDistance()` defined but never used — a deliberate TODO per the comment on line 52 ("simplified — just take first available").
- ❌ Unit mismatch (`kg` vs `piece`) not handled — see [GAPS §1.4](./GAPS_AND_LOOPHOLES.md#-14-demand-matching-ignores-category-correctness-once-accumulation-starts).
- ❌ Delivery worker selection is `pool[idx % pool.length]`, not reliability- or availability-weighted.
- 🟡 After marking items as `matched`, the engine does not check whether a hub has enough nearby delivery workers — could strand items.

**[server/services/rewardEngine.js](../server/services/rewardEngine.js)**
- ✅ The whole engine is well-structured: `calculatePoints`, `awardPoints`, `checkAndAwardBadges`, `checkMilestones`, `getBenefitsForTier`, `resetStreakIfNeeded`, `awardCompletionPoints`.
- ❌ **Zero callers** — see [GAPS §1.1](./GAPS_AND_LOOPHOLES.md#-11-reward-points-are-never-awarded--the-entire-gamification-loop-is-dead).
- ❌ No ledger / signature — once wired up, see [GAPS §2.10](./GAPS_AND_LOOPHOLES.md#-210-internal-rewardengineawardpoints-has-no-caller-guard).

---

### 1.5 Utils

**[server/utils/helpers.js](../server/utils/helpers.js)**
- `generateId()` uses `Date.now() + random` — fine for in-memory, collision-prone at scale; swap for `crypto.randomUUID()` when DB lands.
- `generateQRCode()` emits plaintext strings ([GAPS §2.6](./GAPS_AND_LOOPHOLES.md#-26-qr-codes-are-unsigned-plaintext)).

**[server/utils/verification.js](../server/utils/verification.js)**
- Stores codes in a plain `Map`. Keys expire by checking `expiresAt` on read — never actively cleaned up, so the Map grows unbounded with every send.
- Phone-OTP helpers exist but no route imports them; dead code.
- In dev, falls back to `console.log('Verification code: ######')` — explicitly flagged in the code, but worth warning in the README.

---

## 2. Frontend — client

### 2.1 App shell

**[client/App.jsx](../client/App.jsx)**
- ✅ Clean `BrowserRouter` + `ProtectedRoute requiredRole="..."` per dashboard.
- ⚠️ `QueryClientProvider` is present but not used. Either pick react-query and use it or remove.
- ⚠️ `<Toaster />` and `<Sonner />` both rendered; only shadcn's `Toaster` is "used" (transitively). No handler actually invokes `toast()`; all errors in dashboards use native `alert()`.

**[client/main.jsx](../client/main.jsx)** — trivial Vite entry.

**[client/global.css](../client/global.css)** — tidy Tailwind + HSL tokens; light mode only.

### 2.2 Auth

**[client/context/AuthContext.jsx](../client/context/AuthContext.jsx)**
- ✅ Restores session from `localStorage.auth_token` via `GET /api/auth/me` on mount.
- 🟡 No refresh-token flow; on expiry the 401 bubbles up as `alert('Failed...')`. Add a response interceptor that clears auth state on 401 and re-routes to `/login`.
- 🟡 `token` in localStorage is vulnerable to XSS. If/when CSP lands, consider moving to httpOnly cookies (with matching CSRF protection).

**[client/pages/auth/Login.jsx](../client/pages/auth/Login.jsx)**
- ✅ Two tabs: email/password and Gmail OTP. Both flows work.
- 🟡 Role → route map hardcoded (lines ~22–32). Duplicated in `Register.jsx` and `Index.jsx`. Extract to `client/lib/roles.js`.
- 🟡 No client-side email-format validation; relies on server 401.

**[client/pages/auth/Register.jsx](../client/pages/auth/Register.jsx)**
- 🔴 Role picker includes `admin` in the select; combined with the backend's acceptance ([GAPS §2.3](./GAPS_AND_LOOPHOLES.md#-23-role-spoofing-via-apiauthregister)) this is the explicit exploit path.
- 🟡 Password confirm is checked but no strength requirement.
- 🟡 `location`/address is free text only — not geocoded.

**[client/components/GoogleSignInButton.jsx](../client/components/GoogleSignInButton.jsx)** — fine.

### 2.3 Dashboards

Located in `client/pages/dashboards/`.

| File                              | State           | Observations |
|-----------------------------------|-----------------|--------------|
| `SmallUserDashboard.jsx`          | ✅ Fully wired  | Polls every 30 s (line ~121). Form validation is manual (`alert()`). Submit uses base64 for photos. |
| `LocalCollectorDashboard.jsx`     | ✅ Fully wired  | 4 tabs (Pending / Assigned / Collected / History). Enforces photo before collect. |
| `HubDashboard.jsx`                | ✅ Fully wired  | 2 tabs; verify + flag dialogs. Silent category rewrite issue noted above. |
| `DeliveryWorkerDashboard.jsx`     | ❌ Placeholder  | Renders `DashboardPlaceholder` only; promises 6 features in a list. |
| `RecyclerDashboard.jsx`           | ❌ Placeholder  | Same — placeholder + feature list. |
| `BulkGeneratorDashboard.jsx`      | ❌ Placeholder  | Same. |
| `AdminDashboard.jsx`              | ⚠️ UI only      | Hardcoded metrics (line 15–33). Tool cards render but "Access" buttons have no handler. Logout button has no `onClick` (line ~48). Disputes list is mock. |

Cross-cutting frontend issues:

- 🟡 **No centralised API client.** Each dashboard defines its own `apiFetch = useCallback(...)` with identical bodies. Extract to `client/lib/api.js`.
- 🟡 **No global error handler.** Failures surface as `alert()` calls.
- 🟡 **No loading skeletons.** Empty states appear during fetch.
- 🟡 **No memoization / no suspense.** Everything re-renders on each poll.
- 🟵 **Polling-only in one dashboard** (SmallUserDashboard). Others don't refresh automatically.

### 2.4 Shared components

- **`ProtectedRoute.jsx`** — reads `user` + `isLoading` from AuthContext. Correctly redirects unauth users to `/login` and wrong-role users to their own dashboard.
- **`DataTable.jsx`** — generic table; no virtualised rendering, no server-side pagination.
- **`StatusBadge.jsx`** — hardcoded 14-state mapping. Four states (`matched`, `partially_matched`, `fulfilled`, plus one more) are never rendered because no UI surfaces them. Either use or remove.
- **`components/ui/*`** — standard shadcn Radix components. Generally fine; accessibility is as good as shadcn's defaults, no worse.

---

## 3. Shared / config / build

- **`shared/api.js`** — empty after the TS→JS conversion. Either delete or repopulate with runtime enum helpers (e.g., role constants, status constants).
- **`package.json`** — `zod@3.25.76` listed but never imported. `qrcode@1.5.3` installed but never imported. Clean these up.
- **`.env` file is committed** — verify `.gitignore` entry and purge git history for any secrets that leaked. Include a `.env.example` instead.
- **`.gitignore`** — present but confirm it lists `.env`, `node_modules`, `dist`.
- **`vite.config.js`** and **`vite.config.server.js`** — fine; Express + Vite on one port.
- **`netlify.toml`** — present; no GitHub Actions workflow though.
- **`AGENTS.md`** — still references TypeScript and Vitest. Refresh after the JS conversion.
- **`README.md`** — same; mentions `pnpm typecheck` but no `tsconfig.json` exists anymore.

---

## API surface

All endpoints prefixed `/api`. **Auth** column: `✓` = `verifyAuth` required.

| Method | Path                              | Auth | Role(s)                         | Purpose |
|--------|-----------------------------------|------|----------------------------------|---------|
| POST   | `/auth/register`                  |      | *any (incl. admin ← exploit)*    | Create user directly |
| POST   | `/auth/login`                     |      | —                                | Email + password login |
| POST   | `/auth/google`                    |      | —                                | Google OAuth sign-in |
| POST   | `/auth/send-email-code`           |      | —                                | Send 6-digit OTP to email |
| POST   | `/auth/verify-email-code`         |      | —                                | Verify OTP; either login or issue `verifyToken` |
| POST   | `/auth/register-with-email`       |      | *verifyToken*                    | Complete registration after OTP |
| GET    | `/auth/me`                        | ✓    | any                              | Current user profile |
| PUT    | `/auth/profile`                   | ✓    | any                              | Update name / phone / location |
| POST   | `/intent`                         | ✓    | small_user                       | Submit disposal intent |
| GET    | `/intent`                         | ✓    | small_user, admin                | List user's intents |
| GET    | `/intent/:id`                     | ✓    | small_user, admin                | Intent detail + inventory |
| GET    | `/intent/collected-waste`         | ✓    | small_user                       | Items in collected/delivered/processed state |
| GET    | `/intent/rewards`                 | ✓    | small_user                       | Reward wallet (always 0 today) |
| GET    | `/intent/history`                 | ✓    | small_user                       | Past contributions |
| GET    | `/collector/pending`              | ✓    | local_collector                  | Unassigned intents |
| POST   | `/collector/accept`               | ✓    | local_collector                  | Self-assign to intent |
| GET    | `/collector/assignments`          | ✓    | local_collector                  | My assignments |
| POST   | `/collector/collect`              | ✓    | local_collector                  | Mark collected (photo required) |
| POST   | `/collector/hub-delivery`         | ✓    | local_collector                  | Deliver to hub |
| GET    | `/collector/hubs`                 | ✓    | local_collector                  | List hubs |
| GET    | `/collector/routes`               | ✓    | local_collector                  | My route |
| GET    | `/collector/history`              | ✓    | local_collector                  | Completed collections |
| GET    | `/hub/incoming`                   | ✓    | hub                              | Inbound items (status=at_hub) |
| GET    | `/hub/inventory`                  | ✓    | hub                              | Verified inventory grouped by category |
| POST   | `/hub/verify`                     | ✓    | hub                              | Verify incoming item |
| POST   | `/hub/flag`                       | ✓    | hub                              | Flag discrepancy |
| POST   | `/demand`                         | ✓    | recycler                         | Post new demand |
| GET    | `/demand`                         | ✓    | recycler                         | My demands |
| GET    | `/demand/:id`                     | ✓    | recycler                         | Demand detail + matched items |
| POST   | `/demand/:id/confirm`             | ✓    | recycler                         | Confirm receipt (should award points) |
| GET    | `/demand/:id/deliveries`          | ✓    | recycler                         | Deliveries for this demand |
| GET    | `/delivery/tasks`                 | ✓    | delivery_worker                  | My delivery tasks |
| POST   | `/delivery/:id/pickup`            | ✓    | delivery_worker                  | Pickup from hub |
| POST   | `/delivery/:id/dropoff`           | ✓    | delivery_worker                  | Drop at recycler |
| GET    | `/delivery/earnings`              | ✓    | delivery_worker                  | Earnings & reliability |
| POST   | `/bulk/intent`                    | ✓    | bulk_generator                   | Bulk manifest submit |
| GET    | `/bulk/intent/:id`                | ✓    | bulk_generator                   | Bulk intent detail |
| GET    | `/bulk/certificates`              | ✓    | bulk_generator                   | List compliance certificates |
| GET    | `/admin/dashboard`                | ✓    | admin                            | Aggregated metrics |
| GET    | `/admin/users`                    | ✓    | admin                            | List all users |
| PUT    | `/admin/users/:id`                | ✓    | admin                            | Update user role/active/trust |
| GET    | `/admin/disputes`                 | ✓    | admin                            | All disputes |
| PUT    | `/admin/disputes/:id`             | ✓    | admin                            | Resolve dispute |
| GET    | `/admin/audit`                    | ✓    | admin                            | Traceability audit log |
| GET    | `/admin/config`                   | ✓    | admin                            | Read config |
| PUT    | `/admin/config`                   | ✓    | admin                            | **Stub — doesn't persist** |
| POST   | `/admin/assign-collector`         | ✓    | admin                            | Manual collector assignment |
| GET    | `/admin/intents`                  | ✓    | admin                            | All intents |
| POST   | `/admin/match`                    | ✓    | admin                            | Trigger matching engine |
| GET    | `/ping`                           |      | —                                | Echo env var |
| GET    | `/demo`                           |      | —                                | Template leftover |

**Missing but referenced / expected:**
- `POST /api/dispute` — for users to raise disputes ([GAPS §3.1](./GAPS_AND_LOOPHOLES.md#-31-dispute-creation-endpoint-missing)).
- `POST /api/auth/logout` — for session revocation.
- `POST /api/auth/forgot-password` / `reset-password`.
- `POST /api/upload` — presigned upload once you move photos off base64.

---

## Client → server call matrix

All calls pass `Authorization: Bearer ${token}` unless stated.

| Method | Path                                  | Called from                               |
|--------|----------------------------------------|-------------------------------------------|
| POST   | `/api/auth/login`                      | `Login.jsx`                               |
| POST   | `/api/auth/register`                   | `Register.jsx`                            |
| POST   | `/api/auth/google`                     | `Login.jsx`, `Register.jsx`, `GoogleSignInButton.jsx` |
| POST   | `/api/auth/send-email-code`            | `Login.jsx`, `Register.jsx`               |
| POST   | `/api/auth/verify-email-code`          | `Login.jsx`, `Register.jsx`               |
| POST   | `/api/auth/register-with-email`        | `Register.jsx`                            |
| GET    | `/api/auth/me`                         | `AuthContext.jsx` (on mount)              |
| GET    | `/api/intent`                          | `SmallUserDashboard.jsx`                  |
| POST   | `/api/intent`                          | `SmallUserDashboard.jsx`                  |
| GET    | `/api/intent/rewards`                  | `SmallUserDashboard.jsx`, `RewardWallet.jsx` |
| GET    | `/api/intent/collected-waste`          | `RewardWallet.jsx`                        |
| GET    | `/api/collector/pending`               | `LocalCollectorDashboard.jsx`             |
| GET    | `/api/collector/assignments`           | `LocalCollectorDashboard.jsx`             |
| GET    | `/api/collector/hubs`                  | `LocalCollectorDashboard.jsx`             |
| POST   | `/api/collector/accept`                | `LocalCollectorDashboard.jsx`             |
| POST   | `/api/collector/collect`               | `LocalCollectorDashboard.jsx`             |
| POST   | `/api/collector/hub-delivery`          | `LocalCollectorDashboard.jsx`             |
| GET    | `/api/hub/incoming`                    | `HubDashboard.jsx`                        |
| GET    | `/api/hub/inventory`                   | `HubDashboard.jsx`                        |
| POST   | `/api/hub/verify`                      | `HubDashboard.jsx`                        |
| POST   | `/api/hub/flag`                        | `HubDashboard.jsx`                        |

**Not called anywhere from the frontend** (backend built but no UI yet):
- `/api/demand/*` (Recycler dashboard is a placeholder)
- `/api/delivery/*` (Delivery dashboard is a placeholder)
- `/api/bulk/*` (Bulk generator dashboard is a placeholder)
- `/api/admin/*` (Admin dashboard is a mock)

---

## Strengths worth preserving

While the list of gaps is long, the project has a genuinely solid foundation worth not throwing away:

1. **Clean separation of concerns.** Routes are thin, services hold business logic, models are data-only. Easy to migrate to a real DB.
2. **Role model is well thought out.** 7 roles with clearly different trust levels, cleanly enforced via `requireRole()` middleware and `ProtectedRoute`.
3. **The full item lifecycle is modelled.** 8 inventory states plus a traceability array per item — this is the right shape for an e-waste compliance system.
4. **Reward engine exists in full** — once you wire the call sites, badges/milestones/tiers all "just work".
5. **MatchingEngine is a clear, small, testable unit.** Adding proximity + unit conversion is straightforward.
6. **Auth UX is thoughtful.** Three entry modes (password, email OTP, Google) serve different user segments.
7. **The three completed dashboards (small_user, collector, hub) are honestly functional end-to-end** — you can demo the core flow without pretending.
8. **TailwindCSS + shadcn UI gives a consistent look** with minimal custom CSS.

The work ahead is primarily **making it real** (database, validation, rate limits, QR signing, reward wiring, the three missing dashboards) rather than rebuilding from scratch.

---

_For the prioritised fix roadmap see [GAPS_AND_LOOPHOLES.md §6](./GAPS_AND_LOOPHOLES.md#6-prioritised-roadmap)._
