# Collector → Hub Handoff: nearest-hub suggestion + hub Receive step

**Date:** 2026-06-26
**Status:** Approved (design)
**Scope:** Improve the existing collector→hub delivery flow. No new table.

## Problem

When a collector has collected items ready to drop at a hub, they pick a hub and submit;
the items then appear in the hub's "Incoming" list. Two gaps:

1. The deliver dialog lists hubs sorted nearest-first but does **not show distance** or visibly
   recommend the nearest one.
2. The hub jumps straight to **Verify** — there is no explicit **Receive/Accept** step recording
   that the items physically arrived (who received them, when).

The happy path already works end-to-end and persists to Postgres (inventory `status` +
`traceability`). This is polish + a formalized receipt step, not a rebuild.

## Decisions (from brainstorming)

- **No new table.** Tracking stays on the `inventory` row via a new `received` status and the
  existing `traceability` jsonb log.
- **Add a hub Receive/Accept step** as a two-step handshake before verification.

## Design

### 1. Nearest-hub suggestion (client only)

`GET /api/collector/hubs` already returns hubs sorted nearest-first with `distanceKm`.
In `LocalCollectorDashboard` "Deliver to Hub" dialog:

- Each dropdown option shows the distance, e.g. `Vedant Rane (Hub A) — Koregaon Park · 2.3 km`.
- The nearest hub is default-selected.
- A helper line under the dropdown: **"⭐ Recommended: <nearest hub> (2.3 km away)"**.
- No backend change.

### 2. Hub Receive/Accept step (status lifecycle)

New item timeline:

```
collected → at_hub (pending receipt) → received → verified → matched → in_transit → delivered → processed
```

- **Collector submit** (`POST /api/collector/hub-delivery`) unchanged → items become `at_hub`,
  now meaning "delivered, awaiting hub receipt".
- **`GET /api/hub/incoming`** widened to return items with status `at_hub` **and** `received`
  (filter: `['at_hub','received'].includes(status) && (!hubId || hubId === me)`).
- **New `POST /api/hub/receive` `{ inventoryIds: [] }`**:
  - For each item that is `at_hub` and belongs to this hub: set status `received`, push a
    `received_at_hub` traceability entry `{ actor: hubId, actorName, action, timestamp }`
    (this is the who/when record), set `updatedAt`.
  - Notify the collector(s): "Hub received your items."
  - 404 if no eligible items.
- **`POST /api/hub/verify`** now requires status `received` → 409 otherwise
  ("Receive the items first."). Enforces the two-step.

### 3. Hub Incoming UI (`HubDashboard`)

- Items with status `at_hub`: show a **"Receive"** button + a "pending receipt" badge; Verify hidden.
- Items with status `received`: show the existing **"Verify"** action.

### 4. Records (DB)

All on the existing `inventory` table — `status` plus the `traceability` jsonb log
(`delivered_to_hub` → `received_at_hub` → `verified_at_hub`). Persisted by the write-through
store. **No migration.**

### 5. Status-filter touch-ups

- Collector `/history` "delivered to hub" count includes `received`.
- Admin metrics bucket `received` automatically (no change).

## Error handling

- `receive`: skips items not `at_hub` or not assigned to this hub; 404 if none eligible.
- `verify`: 409 if status is not `received`.

## Testing

- Backend: `node --check` on changed files; a store round-trip that walks one item
  `at_hub → received → verified` and confirms persistence to Postgres.
- Frontend: esbuild parse-check of `LocalCollectorDashboard` and `HubDashboard`; manual
  browser walkthrough (deliver → receive → verify).

## Out of scope

- No new handoff table / entity.
- No changes to recycler/admin request flows.
- No change to the QR box-printing sub-flow (verify still triggers it as today).
```
