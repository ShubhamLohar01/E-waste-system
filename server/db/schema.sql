-- E-Waste Hub — PostgreSQL schema (Supabase)
-- Mirrors the JSON collections in server/data/*.json.
-- Conventions:
--   * id = text PK, reusing the existing "_id" values so cross-references survive.
--   * jsonb  for variable / nested structures.
--   * text[] for plain image-URL arrays (S3 links).
--   * timestamptz for timestamps.
-- Idempotent: safe to re-run (create-if-not-exists + on-conflict inserts in migrate.mjs).

-- 1. users ---------------------------------------------------------------
create table if not exists users (
  id          text primary key,
  name        text not null,
  email       text unique not null,
  password    text not null,                 -- bcrypt hash
  phone       text default '',
  role        text not null,                 -- small_user | local_collector | hub | delivery_worker | recycler | bulk_generator | admin
  trust_level text default 'standard',
  location    jsonb default '{}'::jsonb,      -- { lat, lng, address }
  avatar_url  text,                           -- S3 profile image (future)
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. usr_req_items (was: intents) --------------------------------------
create table if not exists usr_req_items (
  id                 text primary key,
  user_id            text references users(id),
  username           text,                        -- denormalized users.name at submit time
  type               text,
  items              jsonb default '[]'::jsonb,   -- [{ category, estimatedQty, unit, photos[] (S3), condition }]
  status             text default 'submitted',
  assigned_collector text references users(id),
  location           jsonb default '{}'::jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- 3. demands -------------------------------------------------------------
create table if not exists demands (
  id                text primary key,
  recycler_id       text references users(id),
  category          text,
  quantity_needed   numeric,
  unit              text,
  delivery_window   jsonb default '{}'::jsonb,   -- { start, end }
  status            text default 'open',
  matched_inventory jsonb default '[]'::jsonb,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- 4. inventory (core entity — chain of custody) --------------------------
create table if not exists inventory (
  id                  text primary key,
  qr_code             text unique,
  intent_id           text references usr_req_items(id),
  category            text,
  claimed_category    text,
  actual_qty          numeric,
  claimed_qty         numeric,
  unit                text,
  weight_kg           numeric,
  condition           text,
  status              text,
  source_user_id      text references users(id),
  collector_id        text references users(id),
  hub_id              text references users(id),
  delivery_worker_id  text references users(id),
  recycler_id         text references users(id),
  matched_demand_id   text references demands(id),
  verification_photos text[] default '{}',        -- S3 image urls
  traceability        jsonb default '[]'::jsonb,   -- [{ actor, actorName, action, timestamp }]
  quality_rating      integer,                     -- recycler's 1–10 quality score on receipt
  technician_name     text,                        -- recycler technician who assessed quality
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Additive columns (safe on already-created tables) ----------------------
alter table inventory add column if not exists quality_rating  integer;
alter table inventory add column if not exists technician_name text;

-- 5. deliveries ----------------------------------------------------------
create table if not exists deliveries (
  id                 text primary key,
  delivery_worker_id text references users(id),
  pickup_hub         text references users(id),
  dropoff_recycler   text references users(id),
  manifest           jsonb default '[]'::jsonb,   -- [{ inventoryId, qrCode, category, qty, unit, weightKg }]
  status             text,
  pickup_proof       jsonb default '{}'::jsonb,   -- { qrScanned, scannedCount, photo (S3), timestamp }
  dropoff_proof      jsonb default '{}'::jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- 6. disputes ------------------------------------------------------------
create table if not exists disputes (
  id           text primary key,
  raised_by    text references users(id),
  against      text references users(id),
  inventory_id text references inventory(id),
  type         text,
  description  text,
  evidence     text[] default '{}',          -- S3 image urls
  status       text default 'open',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- 7. notifications -------------------------------------------------------
create table if not exists notifications (
  id         text primary key,
  user_id    text references users(id),
  title      text,
  message    text,
  type       text,
  related_id text,                            -- generic ref (intent / inventory / ...)
  read       boolean default false,
  created_at timestamptz default now()
);

-- 8. payments ------------------------------------------------------------
create table if not exists payments (
  id           text primary key,
  inventory_id text references inventory(id),
  recycler_id  text references users(id),
  collected_by text references users(id),
  amount       numeric,
  method       text,                          -- bank_transfer | upi | cash | cheque
  note         text,
  status       text,
  created_at   timestamptz default now()
);

-- 9. rewards (one wallet per user) ---------------------------------------
create table if not exists rewards (
  id             text primary key,
  user_id        text unique references users(id),
  total_points   integer default 0,
  current_streak integer default 0,
  badges         jsonb default '[]'::jsonb,
  milestones     jsonb default '[]'::jsonb,   -- [{ threshold, reached, rewardType }]
  history        jsonb default '[]'::jsonb,   -- [{ action, points, inventoryId, timestamp }]
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Helpful indexes for common lookups -------------------------------------
create index if not exists idx_intents_user        on usr_req_items(user_id);
create index if not exists idx_inventory_status     on inventory(status);
create index if not exists idx_inventory_source     on inventory(source_user_id);
create index if not exists idx_inventory_intent     on inventory(intent_id);
create index if not exists idx_notifications_user   on notifications(user_id);
create index if not exists idx_demands_recycler     on demands(recycler_id);

-- 10. recycler_requests (admin-brokered material requests) ---------------
create table if not exists recycler_requests (
  id                  text primary key,
  recycler_id         text references users(id),
  category            text not null,
  quantity            numeric not null,
  unit                text default 'kg',
  note                text,
  target_date         text,
  status              text default 'pending',     -- pending | approved | partially_approved | fulfilled | rejected | cancelled
  allocated_inventory jsonb default '[]'::jsonb,   -- inventory IDs the admin assigned to this request
  reviewed_by         text references users(id),   -- admin who approved/rejected
  review_note         text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_recycler_requests_recycler on recycler_requests(recycler_id);
create index if not exists idx_recycler_requests_status   on recycler_requests(status);

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

-- 12. category_prices (admin-maintained current market value per category) -----
create table if not exists category_prices (
  category      text primary key,
  current_value numeric not null,
  updated_by    text references users(id),
  updated_at    timestamptz default now()
);

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
