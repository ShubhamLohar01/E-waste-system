# Project Complete — E-Waste Hub (local JSON build)

Everything the user asked for in the rebuild is wired end-to-end. This doc is the single source of truth for **what was built, where things live, how the flow runs, and how to try it**.

---

## 1. Seed accounts (49 users, Pune coords, full addresses)

The seeder runs automatically on first boot and writes JSON files into [`server/data/`](../server/data/). Delete that folder to re-seed. Seeder: [server/seed.js](../server/seed.js).

### Headcount summary

| Role              | Count | Password      |
|-------------------|-------|---------------|
| Admin             | 1     | `admin123`    |
| Small user        | 12    | `user123`     |
| Local collector   | 10    | `collector123`|
| Hub               | 6     | `hub123`      |
| Delivery agent    | 10    | `delivery123` |
| Recycler (company)| 10    | `recycler123` |
| **Total**         | **49**|               |

### Full roster

**Admin (1)**
| Name | Email |
|---|---|
| Rohit Ritthe | `rohit.ritthe@ewaste.com` |

**Small users (12)**
| Name | Email | Area |
|---|---|---|
| Hrithik Sharma | `hrithik@ewaste.com` | Kothrud |
| Kaushal Patil | `kaushal@ewaste.com` | Viman Nagar |
| Tejas Shinde | `tejas.shinde@ewaste.com` | Karve Nagar |
| Suraj Salunkhe | `suraj.salunkhe@ewaste.com` | Sinhagad Road |
| Shubham Lohar | `shubham.lohar@ewaste.com` | Hinjewadi |
| Anita Kulkarni | `anita.kulkarni@ewaste.com` | Sadashiv Peth |
| Rahul Joshi | `rahul.joshi@ewaste.com` | Kalyani Nagar |
| Pooja Desai | `pooja.desai@ewaste.com` | Shivaji Nagar |
| Nikhil Mehta | `nikhil.mehta@ewaste.com` | Hadapsar |
| Snehal Rao | `snehal.rao@ewaste.com` | Balewadi |
| Ajay Bhosale | `ajay.bhosale@ewaste.com` | Parvati |
| Isha Nair | `isha.nair@ewaste.com` | Bavdhan |

**Local collectors (10)**
| Name | Email | Area |
|---|---|---|
| Sahil Wankhede | `sahil.wankhede@ewaste.com` | Deccan Gymkhana |
| Rohan Pawar | `rohan.pawar@ewaste.com` | Baner |
| Aniket Jagtap | `aniket.jagtap@ewaste.com` | Warje Chowk |
| Prasad More | `prasad.more@ewaste.com` | Vishrantwadi |
| Sandeep Ghule | `sandeep.ghule@ewaste.com` | Fursungi |
| Omkar Bagal | `omkar.bagal@ewaste.com` | Pashan |
| Vishal Mohite | `vishal.mohite@ewaste.com` | Bibwewadi |
| Mayur Sonar | `mayur.sonar@ewaste.com` | Yerawada |
| Kiran Borade | `kiran.borade@ewaste.com` | Wakad |
| Tushar Sawant | `tushar.sawant@ewaste.com` | Dhankawadi |

**Hubs (6, full street addresses)**
| Code | Operator | Email | Location |
|---|---|---|---|
| A | Vedant Rane | `vedant.rane@ewaste.com` | Phoenix Trade Centre, Koregaon Park 411001 |
| B | Vipul Ware | `vipul.ware@ewaste.com` | Atul Nagar, Warje-Malwadi Road 411058 |
| C | Aditya Joshi | `aditya.joshi@ewaste.com` | Rajiv Gandhi Infotech Park P1, Hinjewadi 411057 |
| D | Neha Deshmukh | `neha.deshmukh@ewaste.com` | Eon IT Park, Kharadi 411014 |
| E | Amol Gaikwad | `amol.gaikwad@ewaste.com` | Westend Mall Service Road, Aundh 411007 |
| F | Siddharth Kamble | `siddharth.kamble@ewaste.com` | Magarpatta Road, Hadapsar 411028 |

**Delivery agents (10)**
| Name | Email | Base |
|---|---|---|
| Ajit Mane | `ajit.mane@ewaste.com` | Camp / MG Road |
| Prathamesh Kale | `prathamesh.kale@ewaste.com` | Pashan |
| Akash Patole | `akash.patole@ewaste.com` | Parvati Paytha |
| Rohit Lokhande | `rohit.lokhande@ewaste.com` | Kalyani Nagar |
| Swapnil Kadam | `swapnil.kadam@ewaste.com` | Kothrud Depot |
| Chetan Salvi | `chetan.salvi@ewaste.com` | Wakad |
| Nitin Pisal | `nitin.pisal@ewaste.com` | Magarpatta |
| Dinesh Pandit | `dinesh.pandit@ewaste.com` | Balewadi Phata |
| Mahesh Ghadge | `mahesh.ghadge@ewaste.com` | Katraj |
| Yogesh Rathod | `yogesh.rathod@ewaste.com` | Yerawada |

**Recycler companies (10)** — each with CPCB license + rate-per-kg
| Company | Email | Location | Rate/kg |
|---|---|---|---|
| EcoCycle Recyclers Pvt Ltd | `ops@ecocycle.in` | Talegaon MIDC P2 | ₹48 |
| GreenMetal Industries | `procurement@greenmetal.in` | Chakan MIDC P1 | ₹55 |
| ReNewTech Solutions | `sales@renewtech.io` | Phursungi IT Park | ₹52 |
| Vasundhara E-Waste Pvt Ltd | `contact@vasundhara-ewaste.in` | Bhosari MIDC | ₹50 |
| Triveni Recycling | `ops@trivenirecycling.in` | Alandi Road, Chakan | ₹46 |
| CircuitLoop Industries | `hello@circuitloop.co` | Pimpri Industrial Estate | ₹58 |
| EcoRevive Resources | `info@ecorevive.in` | Ranjangaon MIDC | ₹54 |
| MetalMine Recyclers | `procurement@metalmine.co.in` | Uruli Kanchan | ₹60 |
| PlasticPulse Solutions | `business@plasticpulse.in` | Kharadi EPIP | ₹42 |
| Saksham Green Tech | `orders@sakshamgreen.in` | Bhosari Chowk | ₹53 |

---

## 2. Storage model

- **No database.** Each collection is a JSON file in [`server/data/`](../server/data/):
  `users.json · rewards.json · intents.json · inventory.json · demands.json · deliveries.json · disputes.json · notifications.json · payments.json`
- Models just `loadCollection(name)` on boot ([server/lib/jsonDb.js](../server/lib/jsonDb.js#L1)). Any route that mutates an array triggers the `persistAll` middleware ([server/middleware/persistAll.js](../server/middleware/persistAll.js#L1)), which writes all collections back to disk on `res.on('finish')`. Zero route changes needed.
- Survives server restarts. Wipe and re-seed by deleting `server/data/`.

---

## 3. End-to-end flow that actually runs now

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. SMALL USER  submits e-waste                                             │
│     • items[] + photos + address + lat/lng (Google Maps picker)             │
│     • status = submitted                                                    │
│     → server notifies the 3 NEAREST active collectors                       │
│                                                                             │
│  2. COLLECTOR  sees pending list, sorted by distance from their own         │
│     address → clicks Accept → status = assigned                             │
│     → small user gets notification "Your pickup was accepted by X"          │
│                                                                             │
│  3. COLLECTOR  picks up (photo proof required) → status = collected         │
│     → small user gets notification "Items picked up"                        │
│                                                                             │
│  4. COLLECTOR  drops at NEAREST hub (Pune coords shown) → status = at_hub   │
│     → hub gets notification                                                 │
│                                                                             │
│  5. HUB  verifies actual qty + WEIGHT + condition + category                │
│     → status = verified                                                     │
│     → server generates a QR sticker (QR + name + qty + weight) for print    │
│     → admin gets notification "verified batch awaiting approval"            │
│                                                                             │
│  6. ADMIN  opens "Verified" tab, selects items, assigns to a recycler       │
│     company → status = matched                                              │
│     → recycler gets notification "new order"                                │
│                                                                             │
│  7. RECYCLER  picks a delivery agent + items (all from one hub) →           │
│     creates a Delivery record → delivery agent notified                     │
│                                                                             │
│  8. DELIVERY AGENT  confirms hub pickup (photo) → status = in_transit       │
│     → recycler gets notification "shipment on the way"                      │
│                                                                             │
│  9. DELIVERY AGENT  confirms drop-off at recycler (photo) →                 │
│     status = delivered                                                      │
│     → admin gets notification "delivery complete — awaiting payment"        │
│                                                                             │
│ 10. ADMIN  records payment (amount + method) → status = processed           │
│     → REWARD POINTS AWARDED to small user + collector + hub (counter)       │
│     → all three get notifications                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

Every arrow above is backed by a real API call plus UI. No placeholders.

---

## 4. How to run

```bash
# 1. Put your Google Maps JavaScript API key in .env
#    (VITE_GOOGLE_MAPS_API_KEY=AIza... — enable "Maps JavaScript API" and "Places API")
# 2. Install + run
pnpm install
pnpm dev
# http://localhost:8080
```

First boot creates `server/data/*.json`. Restart survives everything.

**If the Maps key is empty**, the picker falls back gracefully: address text field + "Use my location" button (browser geolocation). All other flows work identically.

---

## 5. What was built, by file

### Backend (JSON-backed)
- `server/lib/jsonDb.js` — tiny load/save helpers. **New.**
- `server/middleware/persistAll.js` — flushes mutating responses to disk. **New.**
- `server/utils/distance.js` — haversine + nearest sort. **New.**
- `server/services/notificationService.js` — `notify(userId,…)`, `notifyMany`. **New.**
- `server/services/rewardEngine.js` — `awardPoints`, `awardTripleOnProcessed` (small_user + collector + hub). **Rewritten.**
- `server/models/*.js` — 7 existing + `Notification.js`, `Payment.js`. All now load from JSON.
- `server/seed.js` — seeds team names + Pune coords + sample intents. **Rewritten.**
- `server/routes/intent.js` — on submit, notifies 3 nearest active collectors.
- `server/routes/collector.js` — distance-sorted pending list; notify user on accept / pickup / hub drop.
- `server/routes/hub.js` — records `weightKg`, returns print-ready QR sticker payload, notifies admin.
- `server/routes/admin.js` — **new endpoints:** `GET /verified-items`, `POST /assign-to-recycler`, `GET /orders`, `POST /mark-payment`, `GET /payments`. **Rewritten.**
- `server/routes/delivery.js` — delivery agent view with enriched hub/recycler info + photo-gated pickup/dropoff.
- `server/routes/recycler.js` — **New.** `GET /orders`, `GET /delivery-agents`, `POST /assign-delivery`, `GET /deliveries`.
- `server/routes/notifications.js` — **New.** `GET /`, `POST /read-all`, `POST /:id/read`.
- `server/routes/rewards.js` — **New.** `GET /mine` (any role can read own counter).
- `server/index.js` — mounts all above + the `persistAll` middleware.

### Frontend
- `client/lib/api.js` — centralized JSON fetch with Bearer auth. **New.**
- `client/components/GoogleMapPicker.jsx` — map + Places autocomplete + "Use my location"; clean fallback when key missing. **New.**
- `client/components/QRSticker.jsx` — print-ready sticker (QR on left, name/qty/weight on right) using public QR-image service. **New.**
- `client/components/NotificationsBell.jsx` — bell with unread count + polling every 30 s. **New.**
- `client/pages/dashboards/DeliveryWorkerDashboard.jsx` — **Rewritten** (was placeholder). Active tasks with full hub ⇄ recycler info, photo-proof pickup & dropoff, earnings card.
- `client/pages/dashboards/RecyclerDashboard.jsx` — **Rewritten** (was placeholder). Select items + assign delivery agent, inbound tracker.
- `client/pages/dashboards/AdminDashboard.jsx` — **Rewritten**. 5 tabs: *Verified → assign recycler · Payment due · All orders · Payment ledger · Users*. Replaces hardcoded mock data.
- `client/pages/dashboards/SmallUserDashboard.jsx` — map picker replaces the plain address field; notifications bell added.
- `client/pages/dashboards/LocalCollectorDashboard.jsx` — shows distance-to-user on each pending request; notifications bell.
- `client/pages/dashboards/HubDashboard.jsx` — extra **Weight (kg)** field; verify now renders a print-ready QR sticker inside the dialog.

### Config
- `.env` — added `VITE_GOOGLE_MAPS_API_KEY=` (user fills this in) and `JWT_SECRET=…`.

---

## 6. Reward counter policy

Points fire **only** when admin records payment (step 10). For every processed item:

| Role          | Points awarded                                 |
|---------------|-------------------------------------------------|
| Small user    | full (1/kg or 5/piece)                         |
| Collector     | 50% of the small-user points (rounded, min 1) |
| Hub           | 30% of the small-user points (rounded, min 1) |
| Recycler      | — (paid in cash via the payment flow)          |
| Delivery agent| — (flat ₹250/delivery in earnings card)        |

Defined in [server/services/rewardEngine.js:awardTripleOnProcessed](../server/services/rewardEngine.js#L86).

Every user's reward record auto-creates on the first award if it doesn't already exist — no manual bootstrap needed when new users register.

---

## 7. Notification triggers (what lands in whose bell)

| Event                                   | Recipient(s)                     |
|------------------------------------------|----------------------------------|
| Small user submits intent                | 3 nearest active collectors      |
| Collector accepts intent                 | The small user                   |
| Collector marks collected                | The small user                   |
| Collector drops at hub                   | The receiving hub                |
| Hub verifies                             | All admins                       |
| Admin assigns to recycler                | The recycler                     |
| Recycler assigns a delivery agent        | The delivery agent               |
| Delivery agent picks up from hub         | The recycler                     |
| Delivery agent drops off at recycler     | All admins                       |
| Admin records payment                    | Small user, collector, hub, recycler |

All notifications persist in `server/data/notifications.json`.

---

## 8. Adding users later

Two options, both work:

1. **Register in UI** (`/register`) — new account goes straight into JSON and the flow picks them up. You can add as many collectors, hubs, small users, delivery agents, or recycler companies as you want.
2. **Edit `server/data/users.json` directly** and restart. Passwords are bcrypt-hashed; easiest is to register via UI then edit other fields (name, location, role) if needed.

---

## 9. Things we deliberately kept simple

- No real database (JSON). Fine for a demo or small local pilot. Moving to MongoDB/Postgres later = replace the inside of `loadCollection / saveCollection`.
- No blockchain / tokenisation. Reward is a plain counter (what you asked for).
- `bulk_generator` role and the existing `/api/bulk` + `/api/demand` routes are still present and untouched. The new flow **doesn't use them**, but they don't break anything either.
- No automatic matching engine — admin does the routing manually. That matches the flow you described.
- No dispute creation from the UI (admin still resolves seeded/new disputes via `PUT /api/admin/disputes/:id`). Can be added in ~1 hour if you want it.

---

## 10. Five-minute smoke test

1. Log in as **`hrithik@ewaste.com / user123`** → submit an intent (drop a pin in Pune on the map).
2. Log in as **`sahil.wankhede@ewaste.com / collector123`** → you'll see Hrithik's request, sorted by distance. Accept it.
3. As the same collector, add a photo, hit **Mark as Collected**, then **Deliver to Hub** and pick **Vedant Rane (Hub A)**.
4. Log in as **`vedant.rane@ewaste.com / hub123`** → verify the item with a weight, **print the QR sticker**.
5. Log in as **`rohit.ritthe@ewaste.com / admin123`** → Verified tab → assign the item to **EcoCycle**.
6. Log in as **`ops@ecocycle.in / recycler123`** → select the item → assign **Ajit Mane** as delivery agent.
7. Log in as **`ajit.mane@ewaste.com / delivery123`** → confirm hub pickup (photo), then drop-off at recycler (photo).
8. Back in as Admin → Payment due → record payment ₹X → reward points land in Hrithik's, Sahil's, and Vedant's wallets.

Notifications fire at each step for whoever is involved. You can verify in `server/data/notifications.json` too.

---

**Total new backend endpoints:** 9.
**New client components:** 4 (api, map picker, QR sticker, notifications bell).
**Placeholder dashboards replaced:** 3 (Delivery, Recycler, Admin).
**Data persistence:** yes, JSON-on-disk.
**Reward loop:** now closes.

---

## 11. Mock activity dataset (phase 3 expansion)

The seeder now generates a **rich, realistic demo dataset** on fresh boot. Every dashboard opens onto a busy screen — no placeholders.

### Counts

| Collection | Rows | Notes |
|---|---|---|
| Users | 49 | 1 admin + 12 small + 10 collector + 6 hub + 10 delivery + 10 recycler |
| Intents | 25 | Distributed across all 9 lifecycle states |
| Inventory items | 25 | One per intent, each with a signed QR, traceability, age 0.3–37 days |
| Deliveries | 10 | `picked_up` or `delivered` status, full manifest |
| Payments | 5 | Totalling ₹9,660 in bank transfers |
| Reward awards | ~14 entries | Small user 100 %, collector 50 %, hub 30 % per processed item |
| Demands | 20 | 2 per recycler (seed scaffolding) |
| Disputes | 5 | 3 open + 2 resolved, spanning every involved role |
| Notifications | 29 | Spread across admin + every operational role |

### Lifecycle distribution of the 25 intents

```
submitted  ███ 3    — brand-new, awaiting a collector
assigned   ███ 3    — collector accepted, en route to pick up
at_hub     ███ 3    — dropped at hub, awaiting verification
verified   ███ 3    — hub verified, awaiting admin recycler assignment
matched    ███ 3    — admin approved, recycler hasn't dispatched yet
in_transit ██  2    — delivery agent picked up from hub
delivered  ███ 3    — dropped at recycler, payment pending
processed  █████ 5  — payment collected, rewards awarded
```

### Reward pre-populated balances (from the 5 processed intents)

| Scenario item | Small user (100 %) | Collector (50 %) | Hub (30 %) |
|---|---|---|---|
| 5 Old Laptops (₹4,500) | Shubham Lohar — **25** | Omkar Bagal — **13** | Vedant Rane (Hub A) — **8** |
| 3 Monitors (₹1,080) | Pooja Desai — **15** | Vishal Mohite — **8** | Amol Gaikwad (Hub E) — **5** |
| 10 kg Cables (₹550) | Isha Nair — **10** | Mayur Sonar — **5** | Aditya Joshi (Hub C) — **3** |
| 8 Keyboards (₹1,280) | Ajay Bhosale — **40** | Kiran Borade — **20** | Siddharth Kamble (Hub F) — **12** |
| 4 Circuit Boards (₹2,250) | Hrithik Sharma — **20** | Tushar Sawant — **10** | Neha Deshmukh (Hub D) — **6** |

Small users, collectors, and hubs not listed above have **0 pts** until they participate in a processed item. Exact numbers live in `server/data/rewards.json`.

### Payment ledger (after fresh seed)

| Item | Weight | Recipient | Amount |
|---|---|---|---|
| 5 Old Laptops | 15 kg | EcoCycle | ₹4,500 |
| 3 Monitors | 18 kg | PlasticPulse | ₹1,080 |
| 10 kg Cables | 10 kg | Saksham Green Tech | ₹550 |
| 8 Keyboards & Mouse | 4 kg | GreenMetal | ₹1,280 |
| 4 Circuit Boards | 5 kg | ReNewTech | ₹2,250 |
| **Total** | | | **₹9,660** |

### Reseeding

Mock activity only populates on a **fresh boot**. To regenerate after you've been testing:

```bash
# Option A — wipe and restart
rm -rf server/data
pnpm dev

# Option B — force-reseed without wiping the folder
node server/seed.js      # overwrites all collection JSON files
pnpm dev
```

Either way the log ends with a credential table showing every account and activity counts.

---

## 12. Phase 2 — Gaps & loopholes closed

On top of the working flow above, the following hardening was applied. See [`docs/GAPS_AND_LOOPHOLES.md`](./GAPS_AND_LOOPHOLES.md) for the full resolution table.

### Security
- **Role spoofing fixed.** `POST /api/auth/register` now runs a zod-enforced `PUBLIC_ROLES` enum; admins can never be created via public registration. Defense-in-depth `if (!PUBLIC_ROLES.includes(role))` check in the handler too.
- **Rate limiting** on every auth endpoint via [`server/middleware/rateLimit.js`](../server/middleware/rateLimit.js): login (8/15min), OTP send (5/hr per email), OTP verify (10/15min per email), register (10/hr).
- **JWT secret from env.** `.env` now ships `JWT_SECRET=…`. The middleware still falls back to a dev default, but you should rotate this before shipping.
- **Server-side image validation.** Every data-URL photo is checked via [`validateImageDataUrl`](../server/utils/helpers.js): must be `image/*`, max 5 MB. Applied on intent submit, collector collect, delivery pickup, delivery dropoff.
- **HMAC-signed QR codes.** [`generateQRCode`](../server/utils/helpers.js) produces `INV.<token>.<ts>.<sig>` where `sig = HMAC-SHA256(body, JWT_SECRET).slice(0, 12)`. [`verifyQRCode`](../server/utils/helpers.js) uses `timingSafeEqual` and rejects tampered codes. Delivery pickup/dropoff verifies every manifest QR the agent "scans" against (a) the signature AND (b) membership in the assigned manifest.
- **Logout endpoint.** `POST /api/auth/logout` + the client `logout()` awaits it before clearing state.
- **Zod schemas** for every high-risk body, defined in [`server/schemas.js`](../server/schemas.js). A tiny `validate(schema)` middleware returns a precise 400 on failure.

### New functionality
- **Dispute system (finally).** `POST /api/disputes` creates one; `GET /api/disputes/mine` lists mine. Admins resolve via the Admin Disputes tab. UI is the shared [`RaiseDisputeDialog`](../client/components/RaiseDisputeDialog.jsx) wired into SmallUser, Collector, Hub, and Recycler dashboards. Admins and the targeted user both get notifications.
- **Profile page** at `/profile` for *every* authenticated role. Edit name, phone, and map-picked location. Accessible from a **Profile** button in each dashboard header.
- **Hub traceability fix.** First verify now preserves the originally-claimed qty & category on the inventory record (`claimedQty`, `claimedCategory`) so hub corrections don't erase history.
- **Reward counter visible in Collector + Hub headers.** A coin pill next to the notification bell shows current points, pulled from the new `GET /api/rewards/mine` endpoint (any-role).
- **Admin dashboard — 3 new tabs:**
  - **Unassigned intents** — manually assign a collector to an intent that nobody picked up.
  - **Disputes** — review & resolve with a note; notifies the dispute raiser.
  - **Audit log** — chronological traceability feed across every item (first 500 events).

### Fixes / polish
- **Centralized `api` client** (Bearer token auto-attached) used by every new component/dashboard, replacing inline `apiFetch` declarations.
- **Register page** explicitly excludes `admin` from the role dropdown (server would reject it either way).
- **Logout now asynchronous** in every dashboard header to give the server a chance to log it (best-effort).
- **Notifications bell** polls every 30 s in every dashboard.

### Environment variables (recap)
Already in `.env`:
```
VITE_GOOGLE_MAPS_API_KEY=      # paste your key here
VITE_GOOGLE_CLIENT_ID=…        # Google Sign-In
JWT_SECRET=dev-change-me-…     # rotate before prod!
PING_MESSAGE="ping pong"
```

### 60-second hardening smoke test
1. Try `POST /api/auth/register` with `role: "admin"` in a REST client — you'll see a 400 with `Invalid role…`.
2. Try 9 wrong logins in a row — the 9th returns 429 with a `Retry-After`.
3. Hub verifies an item; check `server/data/inventory.json` — `claimedQty` is preserved separately from `actualQty`.
4. Admin marks payment; check `server/data/rewards.json` — 3 rewards grew (small user, collector, hub).
5. Log in as any role, go to `/profile`, change name + location, save — reload, the edit persists.
6. Raise a dispute from the SmallUser dashboard — it appears in the Admin Disputes tab; resolve it, the raiser gets a notification.
7. Delivery agent taps "Confirm hub pickup" with a fabricated QR code (manually POST a bogus `scannedQrCodes`) — server returns 400 `QR signature invalid`.

Nothing here depends on a database or blockchain. Everything writes through to `server/data/*.json` immediately.
