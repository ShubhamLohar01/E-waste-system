# E-Waste Middleware Platform — Complete Guide

---

## TABLE OF CONTENTS

1. [What is This Project?](#1-what-is-this-project)
2. [How to Run](#2-how-to-run)
3. [Login Credentials](#3-login-credentials)
4. [System Flowchart](#4-system-flowchart)
5. [The 7 Roles Explained](#5-the-7-roles-explained)
6. [Inventory Lifecycle (8 States)](#6-inventory-lifecycle-8-states)
7. [Step-by-Step System Flow](#7-step-by-step-system-flow)
8. [API Endpoints Reference](#8-api-endpoints-reference)
9. [Folder Structure](#9-folder-structure)
10. [Tech Stack](#10-tech-stack)

---

## 1. WHAT IS THIS PROJECT?

This is a **middleware platform** that connects:
- People who have e-waste (old phones, laptops, batteries, etc.)
- Collectors who pick it up
- Hubs that verify and store it
- Recycling companies that process it

**Think of it like Uber for e-waste** — the platform doesn't own anything. It just coordinates everyone.

```
  SUPPLY SIDE                    PLATFORM                    DEMAND SIDE
  ──────────                    ────────                    ───────────
  Small Users ──┐                                      ┌── Recycler 1
  Small Users ──┤    ┌──────────────────────────┐      ├── Recycler 2
  Small Users ──┼───>│   E-Waste Middleware      │<─────┤
  Bulk Company ─┤    │   (Matching + Tracking)   │      └── Recycler 3
  Bulk Company ─┘    └──────────────────────────┘
```

---

## 2. HOW TO RUN

### Prerequisites
- Node.js (v16+)
- **Mock mode (default):** No MongoDB needed. User data is read from `server/data/mockUsers.json`.
- **Real database:** Set `USE_MOCK_DB=false` in `server/.env` and have MongoDB running on localhost:27017.

### Steps

```bash
# Step 1: Install everything
cd "E:\Study material\project"
npm run install:all

# Step 2 (only if using real DB): Seed the database with demo data
# cd server && npm run seed && cd ..

# Step 3: Run both server and client
npm run dev
```

- **Backend** runs on: http://localhost:5000
- **Frontend** runs on: http://localhost:3000

With **mock database** (`USE_MOCK_DB=true` in `server/.env`), the server uses the login credentials from the table below (stored in `server/data/mockUsers.json`). No MongoDB or seed step required.

---

## 3. LOGIN CREDENTIALS

All passwords are: **password123**

| Role              | Email                  | Dashboard URL   |
|-------------------|------------------------|-----------------|
| Admin             | admin@ewaste.com       | /admin          |
| Small User 1      | rahul@test.com         | /user           |
| Small User 2      | priya@test.com         | /user           |
| Collector 1       | amit@test.com          | /collector      |
| Collector 2       | sita@test.com          | /collector      |
| Hub 1             | hub1@test.com          | /hub            |
| Hub 2             | hub2@test.com          | /hub            |
| Delivery Worker 1 | rajesh@test.com        | /delivery       |
| Delivery Worker 2 | manoj@test.com 
                          | /delivery       |
| Recycler 1        | greentech@test.com     | /recycler       |
| Recycler 2        | ecorecycle@test.com    | /recycler       |
| Bulk Generator 1  | techcorp@test.com      | /bulk           |
| Bulk Generator 2  | datacenter@test.com    | /bulk           |

---

## 4. SYSTEM FLOWCHART

### Main Flow (Small Users)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MAIN E-WASTE FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

  PHASE 1: INTAKE
  ═══════════════

  ┌──────────┐     ┌──────────────┐     ┌──────────────┐
  │  Small    │     │   Platform   │     │   Local      │
  │  User     │────>│   assigns    │────>│   Collector   │
  │  submits  │     │   collector  │     │   picks up   │
  │  intent   │     │   to route   │     │   + QR tags  │
  └──────────┘     └──────────────┘     └──────┬───────┘
   Status:              Status:                 │
   SUBMITTED            ASSIGNED           Status: COLLECTED
                                                │
                                                ▼
  PHASE 2: VERIFICATION
  ═════════════════════

  ┌──────────────┐     ┌──────────────┐
  │  Collector   │     │   Hub staff  │
  │  delivers to │────>│   verifies   │
  │  Hub         │     │   qty/type   │
  └──────────────┘     └──────┬───────┘
   Status: AT_HUB             │
                          Status: VERIFIED
                              │
                              ▼
  PHASE 3: MATCHING
  ═════════════════

  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │  Recycler    │     │  Matching    │     │  Delivery    │
  │  submits     │────>│  Engine      │────>│  task created│
  │  demand      │     │  pairs items │     │  + worker    │
  └──────────────┘     └──────────────┘     │  assigned    │
                                             └──────┬───────┘
                                                Status: MATCHED
                                                    │
                                                    ▼
  PHASE 4: DELIVERY
  ═════════════════

  ┌──────────────┐     ┌──────────────┐
  │  Delivery    │     │  Recycler    │
  │  Worker      │────>│  confirms    │
  │  transports  │     │  receipt     │
  │  (QR scan)   │     │  (QR scan)   │
  └──────────────┘     └──────┬───────┘
   Status: IN_TRANSIT         │
                          Status: DELIVERED
                              │
                              ▼
  PHASE 5: CLOSURE
  ════════════════

  ┌──────────────┐     ┌──────────────┐
  │  System      │     │  Small User  │
  │  closes      │────>│  gets reward │
  │  traceability│     │  points +    │
  │  chain       │     │  badges      │
  └──────────────┘     └──────────────┘
   Status: PROCESSED

```

### Bulk Generator Flow (Fast-Track)

```
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │  Bulk Gen    │     │   Hub        │     │  Compliance  │
  │  submits     │────>│   verifies   │────>│  Certificate │
  │  manifest    │     │   (faster)   │     │  issued      │
  └──────────────┘     └──────────────┘     └──────────────┘
  (Skips collector                          (No points/badges
   aggregation)                              just certificates)
```

### Matching Engine Flow

```
  ┌─────────────────────────────────────────────────────┐
  │              MATCHING ENGINE                         │
  │                                                      │
  │  INPUT:  Recycler demand (type + qty + window)       │
  │                     │                                │
  │                     ▼                                │
  │  SCAN:   All inventory where status = 'verified'     │
  │                     │                                │
  │                     ▼                                │
  │  SORT:   By hub proximity to recycler                │
  │                     │                                │
  │                     ▼                                │
  │  MATCH:  Pick items until demand qty is met          │
  │          (may split across multiple hubs)            │
  │                     │                                │
  │                     ▼                                │
  │  OUTPUT: Delivery task + manifest + assigned worker  │
  │                                                      │
  │  FALLBACK: If not enough stock → partial match       │
  │            + backfill notification                   │
  └─────────────────────────────────────────────────────┘
```

### Trust Architecture

```
  ┌─────────────────────────────────────────────────────┐
  │                 TRUST LEVELS                         │
  │                                                      │
  │  HIGHEST ──── Admin (governance, disputes)           │
  │     │                                                │
  │  HIGH ─────── Hub (verification anchor)              │
  │     │         Recycler (final confirmation)          │
  │     │         Bulk Generator (standardized data)     │
  │     │                                                │
  │  MEDIUM ───── Collector (verified at hub)            │
  │     │                                                │
  │  LOW ──────── Small User (intent only)               │
  │               Delivery Worker (QR verified)          │
  └─────────────────────────────────────────────────────┘
```

---

## 5. THE 7 ROLES EXPLAINED

### Role 1: Small User (Trust: LOW)
- **What they do:** Submit e-waste disposal intent (photos + qty)
- **What they CAN'T do:** Request direct pickups
- **Reward:** Points, badges, milestones (NOT cash)
- **Dashboard:** Submit intent, track status, view rewards

### Role 2: Local Collector (Trust: MEDIUM)
- **What they do:** Pick up e-waste, tag with QR codes, deliver to hub
- **Verified by:** Hub re-checks everything they bring
- **Dashboard:** View assignments, log collections, record hub deliveries

### Role 3: Hub (Trust: HIGH — most critical)
- **What they do:** Verify qty/type/condition, categorize, store
- **Why critical:** They are the TRUST ANCHOR — if they lie, system breaks
- **Dashboard:** View incoming, verify items, manage inventory, flag issues

### Role 4: Delivery Worker (Trust: LOW)
- **What they do:** Transport from hub to recycler ONLY
- **Restrictions:** Cannot modify inventory or manifests
- **Verified by:** QR scans at pickup AND dropoff
- **Dashboard:** View tasks, confirm pickup/dropoff with QR

### Role 5: Recycler (Trust: HIGH)
- **What they do:** Submit demand, receive deliveries, confirm receipt
- **Power:** Their confirmation seals the traceability chain
- **Dashboard:** Submit demands, track deliveries, confirm receipt, raise disputes

### Role 6: Bulk Generator (Trust: HIGH)
- **What they do:** Submit large manifests (fast-track flow)
- **Reward:** Compliance certificates (NOT points)
- **Dashboard:** Submit manifests, track status, view certificates

### Role 7: Admin (Trust: HIGHEST)
- **What they do:** Oversee everything, resolve disputes, configure system
- **Dashboard:** Metrics, charts, user management, disputes, audit logs

---

## 6. INVENTORY LIFECYCLE (8 States)

Every e-waste item goes through these states IN ORDER:

```
  ┌────────────┐
  │ 1.SUBMITTED│ ── User declares intent
  └─────┬──────┘
        ▼
  ┌────────────┐
  │ 2.COLLECTED│ ── Collector picks up + QR tag
  └─────┬──────┘
        ▼
  ┌────────────┐
  │ 3.AT_HUB   │ ── Delivered to hub
  └─────┬──────┘
        ▼
  ┌────────────┐
  │ 4.VERIFIED │ ── Hub confirms qty/type/condition
  └─────┬──────┘
        ▼
  ┌────────────┐
  │ 5.MATCHED  │ ── Paired with recycler demand
  └─────┬──────┘
        ▼
  ┌────────────┐
  │ 6.IN_TRANSIT│── Delivery worker transporting
  └─────┬──────┘
        ▼
  ┌────────────┐
  │ 7.DELIVERED│ ── Recycler confirmed receipt
  └─────┬──────┘
        ▼
  ┌────────────┐
  │ 8.PROCESSED│ ── Chain sealed, rewards unlocked
  └────────────┘
```

**Rule:** No state can be skipped. Every transition is logged in the traceability array.

---

## 7. STEP-BY-STEP SYSTEM FLOW

### The 12 Steps (Normal Flow)

| Step | Who Does It       | What Happens                          | Status After    |
|------|-------------------|---------------------------------------|-----------------|
| 1    | Small User        | Submits disposal intent               | SUBMITTED       |
| 2    | Platform/Admin    | Assigns collector to route            | ASSIGNED        |
| 3    | Collector         | Picks up, photos, QR tags             | COLLECTED       |
| 4    | Collector         | Delivers batch to hub                 | AT_HUB          |
| 5    | Hub               | Verifies qty/type/condition           | VERIFIED        |
| 6    | Recycler          | Submits demand request                | —               |
| 7    | Matching Engine   | Pairs verified items with demand      | MATCHED         |
| 8    | Platform          | Creates delivery task + assigns worker| —               |
| 9    | Delivery Worker   | Picks up from hub (QR scan)           | IN_TRANSIT      |
| 10   | Recycler          | Confirms receipt (QR scan)            | DELIVERED       |
| 11   | Platform          | Seals traceability chain              | PROCESSED       |
| 12   | Small User        | Receives reward points/badges         | —               |

### Bulk Generator Flow (3 Steps)

| Step | Who Does It       | What Happens                          |
|------|-------------------|---------------------------------------|
| A1   | Bulk Generator    | Submits bulk manifest (fast-track)    |
| A2   | Hub               | Verifies (faster, standardized)       |
| A3   | Platform          | Issues compliance certificate         |

---

## 8. API ENDPOINTS REFERENCE

### Authentication (All Roles)
```
POST   /api/auth/register    — Create account
POST   /api/auth/login       — Login (returns JWT token)
GET    /api/auth/me           — Get current user info
PUT    /api/auth/profile      — Update profile
```

### Small User
```
POST   /api/intent            — Submit disposal intent
GET    /api/intent             — List my intents
GET    /api/intent/:id         — Get specific intent
GET    /api/rewards            — View points/badges
GET    /api/history            — Past contributions
```

### Collector
```
GET    /api/assignments        — View assigned pickups
POST   /api/collect            — Log collection with proof
POST   /api/hub-delivery       — Record delivery to hub
GET    /api/routes             — View collection routes
GET    /api/collector/history  — Collection history
```

### Hub
```
GET    /api/incoming           — View incoming from collectors
POST   /api/verify             — Verify + categorize items
GET    /api/inventory          — Current hub stock
POST   /api/flag               — Flag discrepancies
```

### Recycler
```
POST   /api/demand             — Submit demand request
GET    /api/demand             — List my demands
GET    /api/demand/deliveries  — Track deliveries
POST   /api/demand/confirm     — Confirm receipt (QR)
GET    /api/demand/processing  — Processing history
```

### Delivery Worker
```
GET    /api/tasks              — View delivery assignments
POST   /api/pickup             — Confirm hub pickup (QR)
POST   /api/dropoff            — Confirm recycler delivery (QR)
GET    /api/earnings           — View earnings/performance
```

### Bulk Generator
```
POST   /api/bulk-intent        — Submit bulk manifest
GET    /api/bulk-intent        — List my manifests
GET    /api/bulk-status/:id    — Track submission status
GET    /api/certificates       — View compliance certificates
```

### Admin
```
GET    /api/admin/dashboard    — System-wide metrics
PUT    /api/admin/config       — Update system config
GET    /api/admin/disputes     — View all disputes
PUT    /api/admin/disputes/:id — Resolve a dispute
GET    /api/admin/audit        — Full traceability logs
GET    /api/admin/users        — List/manage users
PUT    /api/admin/users/:id    — Update user role/status
POST   /api/admin/match        — Trigger matching engine
POST   /api/admin/assign-collector — Assign collector to intents
```

### Shared
```
POST   /api/disputes           — Raise a dispute
GET    /api/disputes           — View my disputes
GET    /api/notifications      — Get notifications
PUT    /api/notifications/:id  — Mark notification read
GET    /api/health             — Health check
```

---

## 9. FOLDER STRUCTURE

```
project/
├── package.json              ← Root (concurrently runs both)
│
├── server/                   ← BACKEND (Express + MongoDB)
│   ├── config/
│   │   ├── db.js             ← MongoDB connection
│   │   └── cloudinary.js     ← Image upload config
│   ├── middleware/
│   │   ├── auth.js           ← JWT verification
│   │   └── roleCheck.js      ← Role-based access control
│   ├── models/               ← 7 MongoDB schemas
│   │   ├── User.js
│   │   ├── Intent.js
│   │   ├── Inventory.js
│   │   ├── Demand.js
│   │   ├── Delivery.js
│   │   ├── Reward.js
│   │   └── Dispute.js
│   ├── controllers/          ← Business logic (1 per route)
│   │   ├── authController.js
│   │   ├── intentController.js
│   │   ├── collectController.js
│   │   ├── hubController.js
│   │   ├── demandController.js
│   │   ├── deliveryController.js
│   │   ├── bulkController.js
│   │   ├── adminController.js
│   │   ├── rewardController.js
│   │   └── disputeController.js
│   ├── routes/               ← API route definitions
│   │   ├── auth.js
│   │   ├── intent.js
│   │   ├── collect.js
│   │   ├── hub.js
│   │   ├── demand.js
│   │   ├── delivery.js
│   │   ├── bulk.js
│   │   ├── admin.js
│   │   └── rewards.js
│   ├── services/             ← Core platform logic
│   │   ├── matchingEngine.js ← Supply-demand matching
│   │   ├── rewardEngine.js   ← Points/badges system
│   │   ├── qrService.js      ← QR code generation
│   │   └── notificationService.js
│   ├── utils/
│   │   ├── constants.js
│   │   └── seed.js           ← Database seeder
│   ├── server.js             ← Express entry point
│   └── .env                  ← Environment variables
│
└── client/                   ← FRONTEND (React)
    └── src/
        ├── components/       ← Shared reusable components
        │   ├── Layout.js     ← Sidebar + top bar
        │   ├── ProtectedRoute.js ← Auth guard
        │   ├── DataTable.js  ← Reusable table
        │   ├── StatsCard.js  ← Dashboard stat card
        │   ├── StatusBadge.js← Colored status chip
        │   ├── QRScanner.js  ← Camera QR scanner
        │   └── PhotoUpload.js← Image upload
        ├── pages/
        │   ├── auth/
        │   │   ├── Login.js
        │   │   └── Register.js
        │   ├── user/Dashboard.js      ← Small User
        │   ├── collector/Dashboard.js ← Collector
        │   ├── hub/Dashboard.js       ← Hub
        │   ├── delivery/Dashboard.js  ← Delivery Worker
        │   ├── recycler/Dashboard.js  ← Recycler
        │   ├── bulk/Dashboard.js      ← Bulk Generator
        │   └── admin/Dashboard.js     ← Admin
        ├── context/
        │   └── AuthContext.js ← Auth state management
        ├── services/
        │   └── api.js        ← Axios + JWT interceptor
        ├── utils/
        │   └── constants.js  ← Roles, colors, helpers
        └── App.js            ← Router + role guards
```

---

## 10. TECH STACK

| Layer        | Technology          | Purpose                    |
|--------------|---------------------|----------------------------|
| Frontend     | React.js            | UI framework               |
| UI Library   | Material UI (MUI)   | Components + styling       |
| Charts       | Recharts            | Dashboard visualizations   |
| Routing      | React Router v6     | Role-based navigation      |
| HTTP Client  | Axios               | API calls with JWT         |
| QR Scanner   | html5-qrcode        | Browser camera QR scanning |
| Backend      | Express.js          | REST API server            |
| Database     | MongoDB + Mongoose  | Data storage               |
| Auth         | JWT + bcryptjs      | Authentication + hashing   |
| QR Gen       | qrcode (npm)        | Server-side QR generation  |
| File Upload  | Multer + Cloudinary | Image storage              |

---

## REWARD SYSTEM RULES

| Rule | Description |
|------|-------------|
| NOT cash | Points/badges only — prevents fraud |
| NOT per-item | Milestone-based — discourages gaming |
| Post-verification only | Unlocks AFTER full chain verified |
| Behavioral nudge | Streaks, badges, community recognition |
| No rewards for bulk generators | They get compliance certificates instead |
| Admin-controlled | Rates and thresholds configurable |

---

## DISPUTE FLOW

```
  Recycler/Hub notices problem
         │
         ▼
  Raises dispute (type + description + evidence)
         │
         ▼
  Admin gets notified
         │
         ▼
  Admin investigates (checks audit trail)
         │
         ▼
  Admin resolves (writes resolution)
         │
         ▼
  Status: RESOLVED
```

**Dispute types:** quantity_mismatch, category_mismatch, damaged, missing

---

## QUICK TEST WALKTHROUGH

1. **Login as Small User** (rahul@test.com) → Submit a new disposal request
2. **Login as Admin** (admin@ewaste.com) → Assign a collector to the intent
3. **Login as Collector** (amit@test.com) → Collect the item, tag with QR
4. **Login as Collector** → Deliver collected items to hub
5. **Login as Hub** (hub1@test.com) → Verify the incoming items
6. **Login as Recycler** (greentech@test.com) → Submit a demand request
7. **Login as Admin** → Run matching engine (pairs verified items to demand)
8. **Login as Delivery Worker** (rajesh@test.com) → Confirm pickup from hub
9. **Login as Delivery Worker** → Confirm dropoff at recycler
10. **Login as Recycler** → Confirm receipt
11. **Login as Small User** → Check reward points increased!

---

*Built with MERN Stack (MongoDB, Express.js, React, Node.js)*
