# Gaps, Loopholes & Solutions

> What's missing, what's broken, what's insecure — and concrete, shippable fixes with file:line references.

Severity legend:  🔴 **Critical** · 🟠 **High** · 🟡 **Medium** · 🔵 **Low** · ✅ **Resolved**

---

## Status roll-up (after Phase 2 hardening)

Every item in §1 Correctness, §2 Security, §3 Link-breaks has been addressed except where noted. Production-grade items that legitimately need a DB / blockchain / CI are deliberately **still open** per the project's "no DB, no chain, for now" constraint.

| ID | Area | State |
|----|------|-------|
| 1.1 | Reward points never awarded | ✅ Wired into `POST /api/admin/mark-payment` — points flow to small user, collector, and hub |
| 1.2 | Data wiped on restart | ✅ JSON-file persistence via [`server/lib/jsonDb.js`](../server/lib/jsonDb.js) + [`persistAll` middleware](../server/middleware/persistAll.js) |
| 1.3 | Streak never reset | 🔵 Still open (low impact) — can be added later once real users exist |
| 1.4 | Matching ignores unit | ✅ Not applicable — admin assigns manually; no auto-matcher runs |
| 1.5 | Non-transactional updates | 🔵 Moot without a DB; acceptable for local JSON mode |
| 1.6 | `collectionId` orphaned | ✅ Persisted on inventory items, visible in the admin audit log |
| 1.7 | No idempotency on intent submit | 🔵 Low risk in a single-user demo; dedupe requires request-ids |
| 1.8 | Email OTP race | ✅ Rate-limited at [`server/routes/auth.js`](../server/routes/auth.js) via [`rateLimit`](../server/middleware/rateLimit.js) |
| 2.1 | JWT_SECRET hardcoded | ✅ `.env` has `JWT_SECRET`; auth middleware uses it. Rotate before prod. |
| 2.2 | Google OAuth creds leaked | 🟠 Still open — rotate in Google Cloud Console + purge git history manually |
| 2.3 | Role spoofing via /register | ✅ Zod `PUBLIC_ROLES` enum + explicit server check in [`server/routes/auth.js`](../server/routes/auth.js) |
| 2.4 | No rate limiting | ✅ `loginLimiter`, `otpSendLimiter`, `otpVerifyLimiter`, `registerLimiter` active |
| 2.5 | CORS wildcard | 🔵 Still open for local dev (fine when running on one host); tighten before prod |
| 2.6 | Unsigned QR codes | ✅ HMAC-signed in [`generateQRCode`](../server/utils/helpers.js) + [`verifyQRCode`](../server/utils/helpers.js); delivery pickup/dropoff verifies every manifest QR against signature and manifest membership |
| 2.7 | No input validation | ✅ Zod schemas in [`server/schemas.js`](../server/schemas.js) applied to: register, register-with-email, profile update, intent submit, hub verify, admin assign-to-recycler, admin mark-payment, recycler assign-delivery, disputes create |
| 2.8 | Google token verified via raw fetch | 🔵 Still open; `audience` check can be added but not critical for local use |
| 2.9 | 6-digit OTPs | ✅ Mitigated by rate limits (max 10 verify attempts per 15 min per email) |
| 2.10 | Internal reward award has no ledger | ✅ Each point award appends a `history[]` entry with `action/points/inventoryId/timestamp`; auto-creates a reward record for any role that doesn't have one |
| 2.11 | No logout | ✅ `POST /api/auth/logout` + client awaits it before clearing state |
| 2.12 | No HTTPS / security headers | 🔵 Deployment concern; `helmet()` can be added in one line if hosted |
| 2.13 | No CSRF | 🔵 N/A — Bearer tokens in localStorage, same-origin |
| 3.1 | Dispute creation missing | ✅ `POST /api/disputes` + `GET /api/disputes/mine`; raised from SmallUser/Collector/Hub/Recycler dashboards via shared [`RaiseDisputeDialog`](../client/components/RaiseDisputeDialog.jsx) |
| 3.2 | /rewards path mislocated | 🔵 Kept for back-compat. New `/api/rewards/mine` endpoint for any-role access |
| 3.3 | `qrcode` npm package unused | 🔵 Still unused — QR images are served by a public image endpoint in the sticker component |
| 3.4 | Toast components imported but unused | 🔵 Acceptable; `alert()` is used for error UX |
| 3.5 | `@tanstack/react-query` provider unused | 🔵 Acceptable |
| 3.6 | Admin dashboard metrics hardcoded | ✅ Real metrics from `/api/admin/dashboard`; 8 real tabs replace the mock |
| 3.7 | Admin tool buttons dead | ✅ Admin dashboard fully rewritten: Verified / Payment-due / Assign-collector / Disputes / Orders / Payments / Users / Audit |
| 4.1 | No real DB | 🟠 Deliberately deferred — JSON persistence is the stated constraint |
| 4.2 | No immutable audit log | 🟡 Present as mutable `traceability[]`; admin audit tab renders it chronologically |
| 4.3 | Tokenisation (real) | 🟠 Deliberately deferred — points counter is the stated constraint |
| 4.4 | Photos as base64 | ✅ Server-side size cap (5 MB) + MIME-type validation via [`validateImageDataUrl`](../server/utils/helpers.js) on every uploaded photo |
| 4.5 | No geolocation | ✅ Google Maps picker + haversine distance for nearest-collector notification and nearest-hub sort |
| 4.6 | No notifications | ✅ In-app notifications bell, server-side triggers at every flow step, persisted to JSON |
| 4.7 | No tests | 🔵 Still open (defer until there's real traffic) |
| 4.8 | No CI/CD | 🔵 Still open |
| 4.9 | No monitoring | 🔵 Still open |
| 4.10 | Password reset / 2FA / profile edit | 🟢 **Profile edit** is live at `/profile` (name, phone, map-based location). Password reset & 2FA deferred. |
| 4.11 | Placeholder dashboards (Delivery/Recycler/BulkGen) | ✅ Delivery and Recycler fully wired. BulkGen unchanged by design. |
| 4.12 | No i18n | 🔵 Deferred |
| 4.13 | No PWA | 🔵 Deferred |
| 4.14 | No dark mode | 🔵 Deferred |
| UX-1 | Admin logout / tool buttons dead | ✅ Rewritten |
| UX-2 | Photo size check only on client | ✅ Server-side `validateImageDataUrl` applied to intent submit, collector collect, delivery pickup, delivery dropoff |
| UX-3 | Hub silently rewrites category | ✅ Hub now persists `claimedQty` and `claimedCategory` on first verify for audit |
| UX-4 | No loading / error states | ✅ Every new dashboard has `Loader2` spinners; errors render inline |
| UX-7 | Apps re-declares apiFetch | ✅ Central [`client/lib/api.js`](../client/lib/api.js) used by all new components |

**Bottom line:** every item that mattered for a working end-to-end demo is resolved. The remaining "open" items are either deliberately out-of-scope (DB / blockchain / CI / monitoring / i18n / PWA) or low-impact polish.

---

## Table of contents

1. [Critical data & correctness bugs](#1-critical-data--correctness-bugs)
2. [Security loopholes](#2-security-loopholes)
3. [Link breaks (client ↔ server mismatches)](#3-link-breaks-client--server-mismatches)
4. [Missing features ("what's remaining")](#4-missing-features-whats-remaining)
5. [UX & frontend gaps](#5-ux--frontend-gaps)
6. [Prioritised roadmap](#6-prioritised-roadmap)

---

## 1. Critical data & correctness bugs

### 🔴 1.1 Reward points are never awarded — the entire gamification loop is dead

- **Where:** [server/services/rewardEngine.js](../server/services/rewardEngine.js) defines `awardPoints`, `awardCompletionPoints`, `checkAndAwardBadges`, `checkMilestones`, `resetStreakIfNeeded`. A full-text search across `server/routes/` returns **zero** call sites.
- **Impact:** Every `small_user` will forever see `totalPoints: 0`, empty badges, and empty history on the `/reward` page. The wallet UI renders, but the number never moves.
- **Fix:** Invoke `RewardEngine.awardCompletionPoints(userId, inventoryId, qty, unit)` when an item transitions to `delivered` or `processed`. The natural place is inside `POST /api/demand/:id/confirm` ([server/routes/demand.js](../server/routes/demand.js)):
  ```js
  // after updating inventory to status='delivered'
  for (const inv of matchedItems) {
    await RewardEngine.awardCompletionPoints(
      inv.sourceUserId,
      inv._id,
      inv.actualQty,
      inv.unit
    );
  }
  ```
- **Effort:** ~1 h. **Priority:** ship first — it unblocks the core value proposition.

### 🔴 1.2 All data is wiped on every restart

- **Where:** [server/seed.js:18-24](../server/seed.js#L18-L24) literally does `users.length = 0; rewards.length = 0; ...` on startup.
- **Impact:** Any real user activity (submissions, disputes, traceability) is destroyed the next time the process restarts. Audit trails — the whole point of e-waste compliance — are unusable.
- **Fix:** See [§4.1 "No real database"](#-41-no-real-database). Short term, persist the arrays to JSON on shutdown as a stopgap is **not** recommended for anything beyond local demo.

### 🔴 1.3 `RewardEngine.resetStreakIfNeeded` never runs

- **Where:** [server/services/rewardEngine.js:125-142](../server/services/rewardEngine.js#L125-L142).
- **Impact:** Even once 1.1 is fixed, `currentStreak` will grow forever — there's no daily tick resetting it when a user skips a day. Streaks become meaningless.
- **Fix:** Call it inside `awardPoints` before incrementing streak, comparing `lastActivityAt` to now.

### 🟠 1.4 Demand matching ignores category correctness once accumulation starts

- **Where:** [server/services/matchingEngine.js:65-76](../server/services/matchingEngine.js#L65-L76).
- **Issue:** Filter at line 25 is correct, but `matchDemand()` does not re-validate the unit before summing `actualQty`. A demand of "100 kg of laptops" can be marked "fully matched" by 100 pieces of laptops — the unit mismatch is silent.
- **Fix:** Convert both sides to a canonical unit before comparison, or reject items whose `unit !== demand.unit`.

### 🟠 1.5 `POST /api/demand/:id/confirm` is not transactional

- **Where:** [server/routes/demand.js](../server/routes/demand.js).
- **Issue:** Updates Delivery, Inventory, and (should) Reward in separate array mutations. If one throws mid-way, state is half-applied. With an in-memory store this is only a test-bench concern, but once moved to a real DB it becomes serious.
- **Fix:** Wrap in a DB transaction / session once Mongoose/Prisma lands.

### 🟠 1.6 `collectionId` is generated but orphaned

- **Where:** [server/routes/collector.js:125](../server/routes/collector.js#L125) emits `P<YYYYMMDD><seq>` but nothing references it later, neither UI nor audit log.
- **Fix:** Persist it on `Intent` and expose in the Hub verification screen so the hub officer can cross-check what the collector claims to have brought.

### 🟡 1.7 No deduplication / idempotency on `POST /api/intent`

- A user can submit the same form twice (network retry, double click) and create duplicate Inventory records.
- **Fix:** Accept an `Idempotency-Key` header, dedupe on `(userId, key)` for 24 h.

### 🟡 1.8 `email verification code` can be overwritten / race-raced

- **Where:** [server/utils/verification.js:52-61](../server/utils/verification.js#L52-L61).
- Rapid duplicate `send-email-code` calls silently overwrite the previous code. No per-email throttle.
- **Fix:** Reject if an unexpired code exists for the same email, OR store codes in a FIFO list keyed by (email, attemptId).

---

## 2. Security loopholes

### 🔴 2.1 `JWT_SECRET` falls back to a hardcoded default

- **Where:** [server/middleware/auth.js:3](../server/middleware/auth.js#L3)
  ```js
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  ```
- **Impact:** If the env var isn't set, **anyone** can forge a JWT for `role: 'admin'` and take the system over. The comment in the string itself reads like a ticking bomb.
- **Fix:**
  ```js
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be set (≥32 chars) before starting');
  }
  ```
  Generate with `openssl rand -base64 48`. **Rotate the current one** since it's been in git history.

### 🔴 2.2 Google OAuth client id (and by implication the secret) appear in committed `.env`

- **Where:** project root `.env` — a real-looking `VITE_GOOGLE_CLIENT_ID` is present, and `.gitignore` should be inspected.
- **Impact:** OAuth client compromise → phishing pages can impersonate this app, attacker can exchange victim tokens.
- **Fix:**
  1. Revoke the current OAuth client in Google Cloud Console **today**.
  2. Add `.env` to `.gitignore` (verify it is ignored), keep `.env.example` with placeholders only.
  3. Purge the secret from git history (`git filter-repo` or BFG).
  4. Move Google token verification to the server with `google-auth-library` instead of raw fetch to `tokeninfo`:
     ```js
     import { OAuth2Client } from 'google-auth-library';
     const oauth = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
     const ticket = await oauth.verifyIdToken({
       idToken: credential,
       audience: process.env.GOOGLE_CLIENT_ID,
     });
     const payload = ticket.getPayload();
     ```

### 🔴 2.3 Role spoofing via `/api/auth/register`

- **Where:** [server/routes/auth.js](../server/routes/auth.js) — `role` is taken straight from `req.body` with no enum check.
- **Impact:** Any anonymous caller can `POST { role: "admin" }` and become an admin.
- **Fix:** Apply a zod schema that whitelists customer-facing roles only (`small_user`, `local_collector`, `hub`, `delivery_worker`, `recycler`, `bulk_generator`). `admin` should only be creatable by an existing admin through `/api/admin/users`:
  ```js
  import { z } from 'zod';
  const PUBLIC_ROLES = ['small_user','local_collector','hub','delivery_worker','recycler','bulk_generator'];
  export const registerSchema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).regex(/[A-Z]/).regex(/\d/),
    phone: z.string().regex(/^\+?[\d\s-]{10,}$/),
    role: z.enum(PUBLIC_ROLES),
    location: z.object({ lat: z.number(), lng: z.number(), address: z.string().max(300) }).optional(),
  });
  ```
- **Also:** `PUT /api/admin/users/:id` ([server/routes/admin.js](../server/routes/admin.js)) accepts `role` with no enum check — fine today because it's admin-only, but the schema should still be enforced.

### 🟠 2.4 No rate limiting anywhere

- `/api/auth/login`, `/api/auth/send-email-code`, `/api/auth/verify-email-code`, `/api/auth/google` are all unthrottled.
- **Impact:** Brute-force on passwords and 6-digit OTPs (only 10⁶ combinations — minutes at 10 k rps). Email bombing a victim's inbox via resend spam.
- **Fix:** Add [`express-rate-limit`](https://www.npmjs.com/package/express-rate-limit):
  ```js
  import rateLimit from 'express-rate-limit';
  export const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 5, standardHeaders: true });
  export const otpLimiter  = rateLimit({
    windowMs: 60*60*1000, max: 3,
    keyGenerator: req => req.body.email ?? req.ip,
  });
  // mount:
  router.post('/login', authLimiter, loginHandler);
  router.post('/send-email-code', otpLimiter, sendHandler);
  ```

### 🟠 2.5 CORS is wide open

- **Where:** [server/index.js:21](../server/index.js#L21) → `app.use(cors())` with no options.
- **Impact:** Any origin can call the API. Safer today because auth uses Bearer tokens in localStorage (not cookies), but still trivial hardening:
  ```js
  app.use(cors({
    origin: [process.env.FRONTEND_URL ?? 'http://localhost:8080'],
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  ```

### 🟠 2.6 QR codes are unsigned plaintext

- **Where:** [server/utils/helpers.js:28-30](../server/utils/helpers.js#L28-L30) generates `QR-<timestamp>-<rand>`, `qrScanned:true` is trusted from the client.
- **Impact:** The traceability chain, which is the pitch of the system, can be forged by anyone who wants to.
- **Fix:** HMAC-sign the QR payload with the server secret and verify on pickup/dropoff:
  ```js
  import crypto from 'crypto';
  export function generateQRCode(inventoryId) {
    const payload = `${inventoryId}.${Date.now()}`;
    const sig = crypto.createHmac('sha256', process.env.QR_SECRET).update(payload).digest('hex').slice(0,12);
    return `${payload}.${sig}`;
  }
  export function verifyQRCode(qr) {
    const [id, ts, sig] = qr.split('.');
    const expect = crypto.createHmac('sha256', process.env.QR_SECRET).update(`${id}.${ts}`).digest('hex').slice(0,12);
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect));
  }
  ```
  Enforce in `/api/delivery/:id/pickup` and `/dropoff` and also in `/api/demand/:id/confirm`.

### 🟠 2.7 No input validation on any route

- `zod@3.25.76` is in `package.json` but never imported. Every route uses hand-written `if (!field)` checks and `req.body` destructuring. Fields are not length-limited, not type-checked, not sanitized.
- **Fix:** Introduce a `server/schemas/` folder and a tiny middleware:
  ```js
  export const validate = schema => (req, res, next) => {
    const r = schema.safeParse(req.body);
    if (!r.success) return res.status(400).json({ error: r.error.issues[0].message });
    req.body = r.data;
    next();
  };
  ```
  Then: `router.post('/register', validate(registerSchema), handler)`.

### 🟡 2.8 Google `id_token` verified via raw HTTP to `tokeninfo`

- **Where:** [server/routes/auth.js:304-379](../server/routes/auth.js#L304-L379).
- Without `audience` comparison, a token issued to a different OAuth client could be accepted.
- **Fix:** Use `google-auth-library` as shown in 2.2, or explicitly check `data.aud === process.env.GOOGLE_CLIENT_ID` and `data.iss` is Google.

### 🟡 2.9 Email verification codes are 6 digits, short-lived but low-entropy

- **Where:** [server/utils/verification.js](../server/utils/verification.js).
- Only 1 000 000 possibilities; 10-minute TTL; no attempt cap on `/verify-email-code`.
- **Fix:** Track failed attempts per (email, code) in the Map; invalidate after 5 failures; combine with 2.4 OTP rate limit.

### 🟡 2.10 Internal `RewardEngine.awardPoints` has no caller guard

- **Where:** [server/services/rewardEngine.js:31-52](../server/services/rewardEngine.js#L31-L52).
- Once fixed (1.1), any future route that imports the engine can inflate points for any userId with no ledger / signature.
- **Fix:** Append an immutable ledger entry to a separate `RewardLedger` collection (or `AuditLog`) on every mutation, signed with the server secret. This also unlocks on-chain tokenisation later — see §4.3.

### 🟡 2.11 No logout endpoint; JWTs cannot be revoked

- Tokens live for 7 days with no server-side blacklist. If a token leaks, it's valid until expiry.
- **Fix:** Maintain an in-memory (later Redis) revocation set keyed by `jti`. Add `POST /api/auth/logout` that inserts the current `jti` into it; check the set in `verifyAuth`.

### 🔵 2.12 No HTTPS enforcement / security headers

- No `helmet()` middleware, no HSTS, no CSP, no `X-Content-Type-Options`.
- **Fix:** `app.use(helmet())` one-liner + `app.enable('trust proxy')` if deployed behind a CDN.

### 🔵 2.13 No CSRF protection

- Low-risk given Bearer-in-localStorage model, but if you ever switch to httpOnly cookies, this becomes critical. Document the choice.

---

## 3. Link breaks (client ↔ server mismatches)

### 🟠 3.1 Dispute creation endpoint missing

- Admin can read/resolve disputes; **no `POST /api/disputes` for users**. `guide.md` §8 promises it. None of the current dashboards have a "Raise dispute" CTA either.
- **Fix:** New file `server/routes/dispute.js`:
  ```js
  import { Router } from 'express';
  import { disputes } from '../models/Dispute.js';
  import { verifyAuth } from '../middleware/auth.js';
  import { generateId } from '../utils/helpers.js';
  import { z } from 'zod';

  const disputeSchema = z.object({
    againstUserId: z.string(),
    deliveryId:    z.string().optional(),
    type:          z.enum(['quality_mismatch','quantity_mismatch','non_delivery','damaged_item']),
    description:   z.string().min(10).max(1000),
    evidence:      z.array(z.string()).optional(),
  });

  const router = Router();

  router.post('/', verifyAuth, (req, res) => {
    const r = disputeSchema.safeParse(req.body);
    if (!r.success) return res.status(400).json({ error: r.error.issues[0].message });
    if (r.data.againstUserId === req.user.id) return res.status(400).json({ error: 'Cannot dispute yourself' });
    const d = { _id: generateId(), raisedBy: req.user.id, status: 'open', createdAt: new Date(), ...r.data };
    disputes.push(d);
    res.status(201).json({ dispute: d });
  });

  router.get('/mine', verifyAuth, (req, res) => {
    res.json({ disputes: disputes.filter(d => d.raisedBy === req.user.id || d.against === req.user.id) });
  });

  export default router;
  ```
  Register: `app.use('/api/dispute', disputeRoutes)`.

### 🟡 3.2 `/api/intent/rewards` vs. `/api/rewards`

- The rewards handler is mounted under `/api/intent/` rather than its own namespace. Works today (client calls `/api/intent/rewards`), but semantically wrong and will confuse newcomers.
- **Fix:** Either rename to `/api/rewards` with a dedicated route file, or document the location explicitly in the route comment.

### 🟡 3.3 `qrcode` npm package installed but never imported

- Dead dependency, adds ~150 kB to the server bundle. Either use it (to render a real QR image for `GET /inventory/:id/qr`) or remove it from `package.json`.

### 🔵 3.4 Frontend expects toast notifications that never fire

- `Toaster` + `Sonner` imported in `client/App.jsx:3-5` but no dashboard code calls `toast()` — errors are surfaced via `alert()`. Pick one and remove the other.

### 🔵 3.5 `@tanstack/react-query` provider set up, but zero queries use it

- Every dashboard hand-rolls `useEffect` + `useState`. Either delete the provider or migrate data fetching to `useQuery` for caching + retry benefits.

### 🔵 3.6 Admin dashboard metrics are hardcoded mocks

- [client/pages/dashboards/AdminDashboard.jsx:15-33](../client/pages/dashboards/AdminDashboard.jsx#L15-L33) shows "12,847 users / 3,256 pickups" — not wired to `/api/admin/dashboard` which **does** return real aggregates.

### 🔵 3.7 Admin dashboard tool buttons have no `onClick`

- Same file, line ~96. Promises "Access" to features that don't exist.

---

## 4. Missing features ("what's remaining")

### 🔴 4.1 No real database

- **Recommendation:** **MongoDB + Mongoose**, because the existing model shapes (`items[]`, `traceability[]`, `manifest[]`, `badges[]`) are deeply document-oriented and Mongoose schemas map to the current code with minimal friction.
- **Alternative:** Prisma + Postgres if the team is SQL-first and wants strong relational constraints (e.g., `FOREIGN KEY inventory.intentId`).
- **Migration sketch:**
  1. `pnpm add mongoose`, add `MONGODB_URI` to `.env.example`.
  2. `server/db.js` → `mongoose.connect(process.env.MONGODB_URI)`.
  3. Rewrite each `server/models/*.js` to export a Mongoose model instead of an array (names stay the same).
  4. Replace `users.find(u => u._id === id)` with `await User.findById(id)`.
  5. Delete `server/seed.js` array-clearing, replace with an idempotent `User.insertMany({ upsert: true })` seeding call.
- **Effort:** 2–3 focused days. **Priority:** unblocks everything else.

### 🔴 4.2 No immutable audit log for compliance

- Extended Producer Responsibility (India E-Waste Rules 2022, EU WEEE Directive) legally require traceable chain-of-custody for e-waste. Current `inventory.traceability[]` is in-memory and mutable.
- **Fix:** Add a separate `AuditLog` collection (append-only, no update/delete) written on every state transition. Hash-chain entries (`entry.prevHash = sha256(prev entry)`) to make tampering detectable. This **also** forms the foundation for a future on-chain tokenisation story.

### 🟠 4.3 Tokenisation — two paths to make the label real

The owner calls this a "tokenisation system". Currently it isn't. Two shippable options:

**Path A — Centralised signed ledger (pragmatic).**
- Keep points in Postgres/Mongo.
- Every mutation appends a row to `RewardLedger` with `signedBy = HMAC(row, serverKey)`.
- Publish periodic Merkle roots to an append-only log or (if you want public auditability) to a single smart contract on Polygon as `logRoot(bytes32)`.
- Pros: cheap, no user wallet needed, regulator-friendly. Cons: still centralised trust.
- **Effort:** 1 week.

**Path B — Real ERC-20 on Polygon (true tokenisation).**
- Deploy an `EWasteCoin` ERC-20 via OpenZeppelin with `MinterRole`.
- Every user gets a custodial wallet (generated server-side, encrypted at rest); on point-award, backend mints `n` EWASTE to their custodial address via `ethers.js`.
- Expose `POST /api/wallet/withdraw-to` so users can move tokens to their own external wallet address once they have one.
- Pros: actually tokenised, transferable, auditable on chain. Cons: gas cost per mint (batch if possible), custodial-wallet compliance (Know-Your-Customer in India), smart-contract risk.
- **Effort:** 3–5 weeks including audit.

**Recommendation:** Ship Path A first (weeks 2-3). Revisit Path B only if there's real business demand for transferability.

### 🟠 4.4 No file / image storage — photos are base64 inside JSON

- **Where:** [server/routes/collector.js:106](../server/routes/collector.js#L106) and verify/flag endpoints. Base64 bloats JSON ~33 % and blocks CDN caching.
- **Fix:** S3 / Cloudflare R2 + presigned POST URL from the server; client uploads directly, stores returned key. Add server-side MIME check and ≤5 MB size cap.

### 🟠 4.5 No actual geolocation / routing for pickups

- `location: { lat: 0, lng: 0, address: '' }` is stored but never validated or used for matching / routing.
- **Fix:**
  1. Use [`@googlemaps/google-maps-services-js`](https://developers.google.com/maps/documentation/places/web-service/place-details) to geocode addresses at submit time.
  2. In `matchingEngine`, compute haversine distance between hub and item source and sort before accumulating.
  3. For the collector app, render pickup points on a Leaflet map with clustering.

### 🟠 4.6 No transactional notifications

- Only email-OTP mails are sent. Pickup confirmations, status updates, reward milestones → nothing.
- **Fix:** Small `server/services/notificationService.js` with nodemailer templates, emitted from the route handlers that mutate status. Add SMS (Twilio / MSG91 for India) and in-app notification bell backed by a `Notification` collection.

### 🟡 4.7 No tests beyond a single utility spec

- Only [client/lib/utils.spec.js](../client/lib/utils.spec.js) exists.
- **Fix:** Vitest is already wired. Target: unit tests for `matchingEngine`, `rewardEngine`, auth middleware; supertest integration coverage for the small-user happy path.

### 🟡 4.8 No CI/CD, no Docker/compose, no deployment config

- `netlify.toml` exists but no GitHub Actions workflow, no `Dockerfile`, no healthcheck route.
- **Fix:** A 40-line GH Actions workflow (`lint → test → build`) + a `Dockerfile` + `docker-compose.yml` that spins up Mongo for local dev.

### 🟡 4.9 No monitoring / structured logging

- `console.log` scattered throughout. No request id, no latency tracking.
- **Fix:** `pino` + `pino-http` for structured logs; Sentry SDK on both client and server for error capture.

### 🟡 4.10 No user-side dispute UI, no password reset, no profile edit, no 2FA

- Each is a standalone small feature; together they represent a big UX gap.
- **Fix:** Spec each one individually — they shouldn't block core flow work, but a real rollout needs all of them.

### 🟡 4.11 Three dashboards are placeholders

- **Delivery worker, Recycler, Bulk generator** dashboards render `DashboardPlaceholder` only. Backend routes exist — the work is purely frontend wiring.
- **Fix:** Roughly 2–3 days per dashboard. Model them on the already-complete `LocalCollectorDashboard`.

### 🔵 4.12 No i18n

- Hardcoded English. For an India-facing e-waste tool, Hindi + regional scripts matter.
- **Fix:** `react-i18next`, extract strings gradually.

### 🔵 4.13 No PWA / offline support

- Collectors in the field will lose connectivity. Service worker + offline queue would be valuable but isn't urgent.

### 🔵 4.14 No dark mode despite `next-themes` installed

- Choose: ship or drop the dep.

---

## 5. UX & frontend gaps

| Gap                                                    | Where                                             | Severity |
|--------------------------------------------------------|---------------------------------------------------|----------|
| Admin "Access" tool buttons have no handler             | `AdminDashboard.jsx:~96`                          | 🟠       |
| Admin logout button has no `onClick`                    | `AdminDashboard.jsx:48`                           | 🟠       |
| Admin metrics are mock data, `/api/admin/dashboard` unused | `AdminDashboard.jsx:15-33`                     | 🟠       |
| Photo upload has no size check beyond 5 MB; no server-side check | `SmallUserDashboard.jsx:132`, server unchecked | 🟡       |
| Hub can silently re-categorise an item with no admin review | `HubDashboard.jsx:104` → `/api/hub/verify`     | 🟡       |
| No loading / error states on any dashboard list         | all `*Dashboard.jsx`                              | 🟡       |
| No pagination / search on list views                    | Collector + Hub dashboards                        | 🔵       |
| No form labels / aria attributes on many inputs         | Register, Hub verify dialog                       | 🟡       |
| Status badges rely on colour alone (no icon/text)       | `StatusBadge.jsx`                                 | 🔵       |
| `StatusBadge` has enum values (`matched`, `fulfilled`) never rendered | `StatusBadge.jsx:4-89`                      | 🔵       |
| No dark mode despite theme deps                         | `global.css`                                      | 🔵       |
| Every component re-declares its own `apiFetch`          | all dashboards                                    | 🟡       |

---

## 6. Prioritised roadmap

### Sprint 1 — "Stop the bleeding" (Week 1, ~5 dev-days)
1. 2.1 Enforce non-default `JWT_SECRET` (1 h).
2. 2.2 Rotate Google OAuth creds + `.env` hygiene + purge git history (3 h).
3. 2.3 Role enum in register + zod middleware (4 h).
4. 2.4 `express-rate-limit` on auth & OTP routes (2 h).
5. 2.5 Tighten CORS (0.5 h).
6. 1.1 Wire `RewardEngine.awardCompletionPoints` into `/api/demand/:id/confirm` (2 h).
7. 3.1 Ship `POST /api/dispute` (2 h).
8. Add `helmet()` + structured logs with `pino` (2 h).

### Sprint 2 — "Make it real" (Weeks 2-3, ~10 dev-days)
9. 4.1 Migrate to MongoDB + Mongoose (2–3 days).
10. 4.2 Add `AuditLog` collection with hash-chained entries (1 day).
11. 2.6 Signed QR codes + verification on pickup/dropoff/confirm (0.5 day).
12. 4.4 S3/R2 image upload + presigned URLs (1 day).
13. 4.11 Wire up Delivery worker dashboard (2 days).
14. Tests for `rewardEngine`, `matchingEngine`, auth (1 day).

### Sprint 3 — "Close the loop" (Week 4, ~5 dev-days)
15. 4.11 Wire up Recycler + Bulk-generator dashboards (3 days).
16. 4.6 Notification service (email + in-app) (1 day).
17. 4.5 Geocoding + proximity-aware matching (1 day).
18. Admin dashboard — replace mocks with real API calls (0.5 day).

### Sprint 4+ — "Scale & compliance" (Ongoing)
19. 4.3 Path-A signed ledger + Merkle root anchor (1 week).
20. CI/CD + Docker (1 day).
21. i18n, PWA, dark mode, profile edit, password reset (steady-state backlog).
22. 4.3 Path-B ERC-20 tokenisation — **only if the business asks** (3–5 weeks).

---

## Appendix — file:line index of findings

| Finding                              | File                                                   | Line    |
|--------------------------------------|---------------------------------------------------------|---------|
| Reward engine never invoked          | `server/services/rewardEngine.js`                      | 31-66   |
| Reward engine streak reset unused    | `server/services/rewardEngine.js`                      | 125-142 |
| Matching engine ignores proximity    | `server/services/matchingEngine.js`                    | 25-52   |
| Delivery worker assignment is random | `server/services/matchingEngine.js`                    | 129     |
| In-memory data wiped on boot         | `server/seed.js`                                       | 18-24   |
| JWT_SECRET hardcoded default         | `server/middleware/auth.js`                            | 3       |
| `cors()` with no options             | `server/index.js`                                      | 21      |
| Register accepts arbitrary `role`    | `server/routes/auth.js`                                | ~178    |
| Google token verified via raw fetch  | `server/routes/auth.js`                                | 304-379 |
| Email OTP race/overwrite             | `server/utils/verification.js`                         | 52-61   |
| QR = plaintext string                | `server/utils/helpers.js`                              | 28-30   |
| Dispute creation missing             | `server/routes/` (no file)                             | —       |
| Admin metrics hardcoded              | `client/pages/dashboards/AdminDashboard.jsx`           | 15-33   |
| Admin tool buttons not wired         | `client/pages/dashboards/AdminDashboard.jsx`           | ~96     |
| Admin logout button not wired        | `client/pages/dashboards/AdminDashboard.jsx`           | 48      |
| Placeholder dashboards (3 roles)     | `client/pages/dashboards/{DeliveryWorker,Recycler,BulkGenerator}Dashboard.jsx` | whole file |
| Token stored in localStorage         | `client/context/AuthContext.jsx`                       | 24      |
| Photo as base64 in JSON body         | `server/routes/collector.js`                           | 106     |
