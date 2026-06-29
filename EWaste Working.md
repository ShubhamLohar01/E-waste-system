# E-Waste Hub — How the Whole Project Works

A simple, complete explanation of the project: what it does, who uses it, the
technology behind it, and every step an item goes through from a person's house to
the recycler.

---

## 1. What is this project?

**E-Waste Hub** is a web app that connects people who want to throw away old
electronics (laptops, phones, cables, batteries, etc.) with the businesses that
recycle them. Instead of e-waste ending up in the trash, the app organizes a clean
chain of people who collect it, check it, transport it, and recycle it — and it pays
and rewards everyone along the way.

Think of it like a delivery app, but for electronic waste, with full tracking of
every item at every step.

---

## 2. The people who use it (Roles)

Every user has one **role**. The role decides what they can see and do.

| Role | Who they are | What they do |
|------|--------------|--------------|
| **Small User** | A normal person / household | Lists their old electronics and requests a pickup |
| **Local Collector** | A person who collects waste locally | Accepts pickup requests, collects items, drops them at a hub |
| **Hub** | A local collection/storage center | Receives items, weighs & checks them, prints QR stickers, stores verified stock |
| **Delivery Worker** | A driver/transporter | Carries verified stock from a hub to a recycler |
| **Recycler** | A recycling company | Requests the materials they need; receives and processes the e-waste |
| **Bulk Generator** | A company/office with lots of e-waste | Submits large batches of e-waste at once |
| **Admin** | The platform operator (the "middleman") | Oversees everything, connects hubs and recyclers, records payments, resolves problems |

A key idea: **the recycler never sees which hub the goods came from, and the hub
never sees which recycler they go to.** The **admin sits in the middle** and keeps
both sides private. Each side only sees an anonymous code like `HUB-9F3A2C` or
`REC-7B21C0`.

---

## 3. The technology (Tech Stack)

### Language
- **JavaScript** everywhere (not TypeScript). The front-end uses **JSX** (JavaScript +
  HTML-like syntax for React). The back-end uses modern JavaScript modules (ESM).

### Front-end (what the user sees in the browser)
- **React 18** — builds the user interface out of reusable components.
- **Vite** — the build tool / dev server (fast reloads while developing).
- **React Router** — handles moving between pages (login, dashboards, profile).
- **Tailwind CSS** — styling using utility classes.
- **Radix UI + shadcn-style components** — ready-made accessible UI pieces (dialogs,
  dropdowns, tabs, etc.).
- **lucide-react** — the icon set.
- **Google Maps / Leaflet** — maps for picking pickup locations and showing directions.
- **qrcode** — generates QR codes for items and boxes.

### Back-end (the server that does the work)
- **Node.js + Express 5** — the web server that answers requests from the browser.
- **PostgreSQL** (hosted on **Supabase**) — the real database where all data is stored.
- **pg** — the driver that lets the server talk to PostgreSQL.
- **JWT (jsonwebtoken)** — login tokens that prove who you are on each request.
- **bcrypt** — scrambles (hashes) passwords so they're never stored in plain text.
- **Zod** — checks that incoming data is valid before it's used.
- **AWS S3** — stores uploaded images and invoice files (photos, bills).
- **nodemailer** — sends verification code emails.

### How front-end and back-end talk
The browser calls **API endpoints** like `/api/intent`, `/api/hub/incoming`,
`/api/admin/recycler-requests`. The server replies with **JSON** (plain data). The
browser then shows that data on the screen.

---

## 4. How the data is stored (Architecture)

This part is a little technical but important.

1. **The real storage is PostgreSQL** (a proper database in the cloud, on Supabase).
2. When the server **starts up**, it loads every table from PostgreSQL into memory
   as simple lists (this is called **hydrate**).
3. While the app runs, the code works on those in-memory lists (fast).
4. After **any change** (someone creates/updates/deletes something), the server
   **writes the lists back to PostgreSQL** (this is called **flush**). This keeps the
   database always up to date and the data survives restarts.

So the in-memory lists act like a fast cache, and PostgreSQL is the permanent home.
This design let the project switch from old JSON files to a real database **without
rewriting all the page logic**.

### Database tables
- **users** — everyone's account (name, email, hashed password, role, location, trust level)
- **intents** — a small user's request to dispose e-waste (the list of items)
- **inventory** — each physical item/lot, tracked through the whole journey (the heart of the system); also holds the recycler's `quality_rating` (1–10) and `technician_name` once received
- **demands** — older recycler demand records (legacy)
- **recycler_requests** — a recycler asks the admin for a category + quantity
- **deliveries** — transport jobs from hub to recycler
- **boxes** — the QR-tagged boxes created when a hub verifies items
- **payments** — money records for processed items
- **rewards** — points, streaks, badges for users
- **disputes** — complaints raised by any role
- **notifications** — in-app alerts

### Images and files (S3)
- When someone uploads a **photo** or **invoice (PDF/image)**, the server uploads the
  file to a **private AWS S3 bucket** and stores only the **link (URL)** in the database
  (not the heavy file).
- Because the bucket is private, the server creates a short-lived **"presigned" link**
  whenever the browser needs to show the image. A central piece of code does this
  automatically for **every** response, so images load but the bucket stays private.

---

## 5. Security & login

- Users **register** with name, email, password, role, and address. The password is
  **hashed with bcrypt** before saving.
- **Email verification** uses a 6-digit code (sent via email, or shown in the server
  log during development).
- **Google Sign-In** is also supported.
- On login, the server gives the browser a **JWT token**. The browser sends this token
  with every request to prove who it is.
- Each protected endpoint checks the token and the user's **role** (for example, only a
  `hub` user can call hub endpoints).

---

## 6. The main journey of an item (the full flow)

This is the core of the whole app. Follow one batch of old laptops from a person's
home all the way to the recycler.

```
Small User → Collector → Hub → (Admin) → Delivery Worker → Recycler → Admin (payment)
```

### Step 1 — Small User submits e-waste
- The small user opens **"Submit E-Waste for Disposal"**.
- For each item they choose a **category** (e.g. Old Laptops), **quantity**, **unit**,
  **condition**, optional **photos** (upload or **in-app camera**), and an optional
  **invoice** (PDF/image).
- They pick a **pickup location** on the map.
- On submit, the app creates one **intent** and one **inventory** row per item.
- Photos/invoices are uploaded to **S3**; their links are saved.
- The nearest active **collectors** are notified.
- **Item status: `submitted`**

### Step 2 — Collector accepts and collects
- A collector sees pending pickups **sorted by distance** from them. Once the
  collector has set their live location, requests **farther than 15 km are hidden**,
  so they only see nearby work.
- They **accept** a request (it locks to them). The small user is notified.
  **Intent status: `assigned`**
- They visit the address, collect the items, take a photo, and mark **collected**. A
  collection ID and QR code are generated. **Item status: `collected`**

### Step 3 — Collector delivers to a Hub
- In the collector's "Collected" tab, each batch has a **"Deliver to Hub"** button.
- A dialog shows hubs **sorted nearest-first**, each with its **distance**, and the
  **nearest one is recommended** (`★ Recommended`).
- The collector picks a hub and confirms. **Item status: `at_hub`** (means "delivered,
  waiting for the hub to confirm it arrived"). The hub is notified.

### Step 4 — Hub receives (the Receive step)
- The hub's **"Incoming"** list shows the arriving items with a **"Pending receipt"**
  badge and a **"Receive"** button.
- The hub clicks **Receive** to confirm the items physically arrived.
  **Item status: `received`** — and a `received_at_hub` record (who + when) is saved in
  the item's history. The collector is notified.

### Step 5 — Hub verifies + prints QR box stickers
- For a `received` item, the hub clicks **"Verify Item"**.
- The hub records the **real quantity, weight, condition**, adds photos, and chooses how
  many **boxes** to split it into.
- The system stages **QR-coded boxes** for preview. **Item status: `pending_print`**.
- The hub **prints** the box stickers, then confirms. **Item status: `verified`** and the
  admin is notified that verified stock is ready.
- (A safety rule: an item **cannot be verified before it is received** — this enforces
  the two-step handshake.)

### Step 6 — Admin connects the stock to a Recycler
There are **two ways** stock reaches a recycler, and the admin controls both:

**A) Admin pushes stock (existing flow)**
- The admin sees all **verified** items and a list of recyclers.
- The admin assigns chosen items to a recycler. **Item status: `matched`**. The recycler
  is notified.

**B) Recycler pulls (new "request" flow)**
- A recycler raises a **material request**: "I need X category, Y quantity" (with an
  optional note and needed-by date). **Request status: `pending`**.
- The admin sees the request in a **"Recycler requests"** tab, along with how much
  matching verified stock exists.
- The admin **approves** it by picking which verified items fulfil it (or **rejects**
  it). Approved items become **`matched`** and are linked to that recycler.
  **Request status: `partially_approved` or `fulfilled`**.
- Throughout this, the recycler only sees a **hub code**, and the hub only sees a
  **recycler code** — the admin is the private middleman.

### Step 7 — Recycler arranges delivery
- The recycler sees the items assigned to them (the hub shown only as a code like
  `HUB-9F3A2C`) in an **"Assigned to you (awaiting pickup)"** list.
- They pick a **delivery worker** to carry the items from the hub to their facility.
  A **delivery** job is created and the driver is notified.
- Those items then leave the selectable list and move into a read-only
  **"Dispatched — awaiting pickup"** section. (The item stays `matched` with a driver
  attached; it only becomes `in_transit` when the driver actually picks it up.)

### Step 8 — Delivery and receipt
- The delivery worker picks up the boxes from the hub (QR scan) — **item status:
  `in_transit`** — and drops them at the recycler (QR scan + proof photo).
- The recycler **acknowledges** each box by scanning its QR. When all boxes are
  acknowledged, the item is marked received. **Item status: `delivered`**.
- After receipt, the recycler records a **quality assessment** for the item: the
  **technician's name** and a **quality rating from 1 to 10**. This is saved on the item
  (and in its history) for traceability.

### Step 9 — Payment and rewards
- The admin records the **payment** the recycler paid (amount, method, note).
  **Item status: `processed`**, a **payment** record is created.
- The system then **awards reward points** to the three contributors: the small user,
  the collector, and the hub. Everyone is notified.

---

## 7. The item status lifecycle (quick reference)

```
submitted  → a small user listed it
assigned   → a collector accepted the pickup
collected  → collector picked it up
at_hub     → dropped at a hub, waiting for hub to confirm
received   → hub confirmed it arrived
pending_print → hub staged QR boxes, ready to print
verified   → printed & quality-checked, ready to assign
matched    → assigned/approved to a recycler (a delivery worker may also be assigned =
             "dispatched, awaiting pickup")
in_transit → a delivery worker is carrying it
delivered  → recycler received & acknowledged it
processed  → payment recorded, rewards given (final)
```

Every status change also writes a **traceability** entry (who did it, what they did,
when) onto the item, so the **admin can audit the full history** of any item.

---

## 8. Supporting features

### Rewards (gamification)
The reward engine awards **points** to the small user, collector, and hub when an item
is processed, and tracks **streaks** and **badges/milestones** (Bronze, Silver, Gold,
Platinum). The **points wallet is shown only on the Small User dashboard**; the collector
and hub still earn points behind the scenes but no longer show a points counter in their
dashboard.

### Notifications
Every important event (pickup accepted, items received, request approved, payment
recorded, etc.) creates an **in-app notification** for the right person, shown via the
bell icon.

### Disputes
Any role can **raise a dispute** (e.g. "quantity didn't match", "item damaged") with a
description and evidence. The **admin reviews and resolves** them.

### Payments ledger
Every payment the admin records is stored, and the admin can see a complete
**payment history**.

### Anonymity (privacy between hub and recycler)
A helper turns a real user ID into a stable code like `HUB-9F3A2C` or `REC-7B21C0`. The
recycler and hub only ever see these codes for each other, so they can't bypass the
admin. The admin sees the real names.

### QR boxes & stickers
When a hub verifies an item, it's split into one or more **boxes**, each with its own
**QR code and printable sticker**. These QR codes are scanned during delivery and when
the recycler acknowledges receipt, giving precise box-level tracking.

### Traceability / audit log
The admin can view a single **chronological log** of every action across every item —
useful for trust, accountability, and resolving disputes.

---

## 9. Project structure (where things live)

```
ewaste-system/
├── client/                      # Front-end (React)
│   ├── pages/
│   │   ├── auth/                # Login, Register
│   │   └── dashboards/          # One dashboard per role
│   │       ├── SmallUserDashboard.jsx
│   │       ├── LocalCollectorDashboard.jsx
│   │       ├── HubDashboard.jsx
│   │       ├── RecyclerDashboard.jsx
│   │       ├── DeliveryWorkerDashboard.jsx
│   │       ├── BulkGeneratorDashboard.jsx
│   │       └── AdminDashboard.jsx
│   ├── components/              # Reusable UI (camera, maps, QR, dialogs, ...)
│   ├── context/AuthContext.jsx  # Holds the logged-in user + token
│   └── lib/api.js               # Small helper to call the server with the token
│
├── server/                      # Back-end (Express)
│   ├── index.js                 # Starts the server, wires up routes & middleware
│   ├── routes/                  # One file per area (auth, intent, collector, hub,
│   │                            #   admin, recycler, delivery, demand, disputes, ...)
│   ├── models/                  # In-memory lists, one per table
│   ├── lib/
│   │   ├── db.js                # PostgreSQL connection pool
│   │   └── pgStore.js           # hydrate (DB → memory) + flush (memory → DB)
│   ├── middleware/              # Auth check, save-to-DB, S3 link signing
│   ├── services/                # S3 upload, notifications, rewards, matching
│   ├── utils/                   # Helpers (IDs, distance, validation, masking, ...)
│   ├── db/
│   │   ├── schema.sql           # The SQL that creates all tables
│   │   └── migrate.mjs          # One-time loader (used during the DB switch)
│   └── schemas.js               # Zod rules for validating incoming data
│
└── .env                         # Secret settings (DB URL, JWT secret, AWS keys, ...)
```

---

## 10. How to run it

1. **Install dependencies:** `npm install`
2. **Set up `.env`** with: `DATABASE_URL` (Supabase Postgres), `JWT_SECRET`,
   `AWS_S3_BUCKET_NAME` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION`,
   and the Google keys.
3. **Create the tables** by running `server/db/schema.sql` in Supabase (one time).
   Small **additive columns** (e.g. inventory's `quality_rating` / `technician_name`)
   are also applied automatically at server startup, so you don't need to re-run the
   whole schema for those.
4. **Start developing:** `npm run dev` (front-end) — the Express server is wired in.
5. **Build for production:** `npm run build`, then `npm start`.

---

## 11. One-paragraph summary

A small user lists their old electronics and requests a pickup. A nearby collector
accepts, collects, and drops the items at the nearest hub. The hub confirms receipt,
weighs and checks the items, and prints QR-coded box stickers. The admin — acting as a
private middleman — connects that verified stock to a recycler, either by assigning it
directly or by approving a request the recycler raised. A delivery worker transports the
boxes to the recycler, who scans and acknowledges each box. Finally the admin records
the payment, the system rewards the small user, collector, and hub with points, and the
item's complete history is saved for auditing. All data lives in PostgreSQL, images live
in private S3 storage, and every action is tracked end to end.
```
