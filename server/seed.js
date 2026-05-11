import { users } from './models/User.js';
import { rewards } from './models/Reward.js';
import { intents } from './models/Intent.js';
import { inventory } from './models/Inventory.js';
import { demands } from './models/Demand.js';
import { deliveries } from './models/Delivery.js';
import { disputes } from './models/Dispute.js';
import { notifications } from './models/Notification.js';
import { payments } from './models/Payment.js';
import { hashPassword, generateId, generateQRCode } from './utils/helpers.js';
import { flushAll } from './middleware/persistAll.js';

/**
 * Seed the in-memory (JSON-backed) store with the team's specific users.
 *
 * Names (Pune, India):
 *   admin            → Rohit Ritthe
 *   small_user       → Hrithik, Kaushal, Tejas Shinde, Suraj Salunkhe, Shubham Lohar
 *   local_collector  → Sahil Wankhede, Rohan Pawar
 *   hub              → Vedant Rane, Vipul Ware
 *   delivery_worker  → Ajit Mane, Prathamesh Kale
 *   recycler (co.)   → EcoCycle Recyclers Pvt Ltd, GreenMetal Industries, ReNewTech Solutions
 *
 * Runs only if `users.json` is empty / missing; otherwise keeps persisted data.
 */
/**
 * The 4 canonical hubs + their full Pune addresses. Kept outside the fresh-seed
 * path so `topUpHubs()` can upsert them safely on every restart — that way the
 * two new hubs (C & D) appear for users who already seeded with just A & B.
 */
const CANONICAL_HUBS = [
  {
    email: 'vedant.rane@ewaste.com',
    name: 'Vedant Rane (Hub A — Koregaon Park)',
    lat: 18.5362,
    lng: 73.8958,
    address: '1st Floor, Phoenix Trade Centre, North Main Road, Koregaon Park, Pune 411001',
    phone: '+91-96200-00001',
  },
  {
    email: 'vipul.ware@ewaste.com',
    name: 'Vipul Ware (Hub B — Warje)',
    lat: 18.4932,
    lng: 73.8277,
    address: 'Shop 14, Atul Nagar, Warje-Malwadi Road, Warje, Pune 411058',
    phone: '+91-96200-00002',
  },
  {
    email: 'aditya.joshi@ewaste.com',
    name: 'Aditya Joshi (Hub C — Hinjewadi)',
    lat: 18.5912,
    lng: 73.7389,
    address: 'Plot 42, Rajiv Gandhi Infotech Park Phase 1, Hinjewadi, Pune 411057',
    phone: '+91-96200-00003',
  },
  {
    email: 'neha.deshmukh@ewaste.com',
    name: 'Neha Deshmukh (Hub D — Kharadi)',
    lat: 18.5542,
    lng: 73.9502,
    address: 'Unit 3B, Eon IT Park, Kharadi Bypass Road, Kharadi, Pune 411014',
    phone: '+91-96200-00004',
  },
  {
    email: 'amol.gaikwad@ewaste.com',
    name: 'Amol Gaikwad (Hub E — Aundh)',
    lat: 18.5593,
    lng: 73.8071,
    address: 'Gala 7, Westend Mall Service Road, Aundh, Pune 411007',
    phone: '+91-96200-00005',
  },
  {
    email: 'siddharth.kamble@ewaste.com',
    name: 'Siddharth Kamble (Hub F — Hadapsar)',
    lat: 18.5089,
    lng: 73.9260,
    address: 'Warehouse 11, Magarpatta Road, Hadapsar, Pune 411028',
    phone: '+91-96200-00006',
  },
];

/**
 * Build a rich spread of demo activity so every role's dashboard has content:
 *   • 16 intents distributed across all 9 inventory lifecycle states
 *   • Matching inventory rows with full traceability timelines
 *   • Delivery records for in_transit/delivered items
 *   • Payment records + reward awards for processed items
 */
async function generateMockActivity({ admin, smallUsers, collectors, hubs, deliveryAgents, recyclers }) {
  // su / co / hu / re / da = index into the named arrays. null = not yet involved.
  // Target distribution across 9 lifecycle states: 3/3/0/3/3/3/2/3/5 = 25 intents.
  const scenarios = [
    // submitted (3) — fresh requests awaiting a collector
    { su: 0,  co: null, hu: null, re: null, da: null, cat: 'Old Laptops',       q: 2,  un: 'pieces', wt: null, ago: 0.3, end: 'submitted' },
    { su: 3,  co: null, hu: null, re: null, da: null, cat: 'Batteries',         q: 5,  un: 'pieces', wt: null, ago: 0.7, end: 'submitted' },
    { su: 8,  co: null, hu: null, re: null, da: null, cat: 'Mobile Phones',     q: 3,  un: 'pieces', wt: null, ago: 1.0, end: 'submitted' },

    // assigned (3) — collector accepted, pickup pending
    { su: 1,  co: 2,    hu: null, re: null, da: null, cat: 'Electronic Cables', q: 4,  un: 'kg',     wt: null, ago: 2,   end: 'assigned' },
    { su: 5,  co: 4,    hu: null, re: null, da: null, cat: 'Monitors',          q: 2,  un: 'pieces', wt: null, ago: 2.5, end: 'assigned' },
    { su: 10, co: 6,    hu: null, re: null, da: null, cat: 'Printers',          q: 1,  un: 'pieces', wt: null, ago: 3,   end: 'assigned' },

    // at_hub (3) — collector dropped at hub, awaiting verification
    { su: 2,  co: 0,    hu: 0,    re: null, da: null, cat: 'Keyboards & Mouse', q: 6,  un: 'pieces', wt: 3,    ago: 4,   end: 'at_hub' },
    { su: 6,  co: 1,    hu: 2,    re: null, da: null, cat: 'Batteries',         q: 12, un: 'pieces', wt: 4,    ago: 4.5, end: 'at_hub' },
    { su: 11, co: 3,    hu: 4,    re: null, da: null, cat: 'Circuit Boards',    q: 8,  un: 'pieces', wt: 5,    ago: 5,   end: 'at_hub' },

    // verified (3) — hub verified, awaiting admin recycler assignment
    { su: 4,  co: 0,    hu: 1,    re: null, da: null, cat: 'Old Laptops',       q: 3,  un: 'pieces', wt: 9,    ago: 6,   end: 'verified' },
    { su: 7,  co: 5,    hu: 3,    re: null, da: null, cat: 'Mobile Phones',     q: 10, un: 'pieces', wt: 2,    ago: 7,   end: 'verified' },
    { su: 9,  co: 7,    hu: 5,    re: null, da: null, cat: 'Electronic Cables', q: 6,  un: 'kg',     wt: 6,    ago: 8,   end: 'verified' },

    // matched (3) — admin assigned to a recycler, recycler not yet dispatched a delivery agent
    { su: 0,  co: 1,    hu: 0,    re: 0,    da: null, cat: 'Monitors',          q: 2,  un: 'pieces', wt: 10,   ago: 9,   end: 'matched' },
    { su: 6,  co: 2,    hu: 2,    re: 3,    da: null, cat: 'Old Laptops',       q: 2,  un: 'pieces', wt: 6,    ago: 10,  end: 'matched' },
    { su: 3,  co: 8,    hu: 4,    re: 5,    da: null, cat: 'Batteries',         q: 15, un: 'pieces', wt: 6,    ago: 11,  end: 'matched' },

    // in_transit (2) — delivery agent picked up from hub
    { su: 1,  co: 0,    hu: 0,    re: 1,    da: 0,    cat: 'Monitors',          q: 3,  un: 'pieces', wt: 15,   ago: 13,  end: 'in_transit' },
    { su: 10, co: 9,    hu: 5,    re: 2,    da: 3,    cat: 'Old Laptops',       q: 4,  un: 'pieces', wt: 12,   ago: 14,  end: 'in_transit' },

    // delivered (3) — handed over to recycler, payment pending
    { su: 5,  co: 1,    hu: 2,    re: 6,    da: 1,    cat: 'Mobile Phones',     q: 20, un: 'pieces', wt: 4,    ago: 17,  end: 'delivered' },
    { su: 8,  co: 3,    hu: 3,    re: 4,    da: 5,    cat: 'Electronic Cables', q: 8,  un: 'kg',     wt: 8,    ago: 19,  end: 'delivered' },
    { su: 2,  co: 4,    hu: 1,    re: 7,    da: 2,    cat: 'Batteries',         q: 25, un: 'pieces', wt: 10,   ago: 22,  end: 'delivered' },

    // processed (5) — admin recorded payment, rewards awarded
    { su: 4,  co: 5,    hu: 0,    re: 0,    da: 0,    cat: 'Old Laptops',       q: 5,  un: 'pieces', wt: 15,   ago: 25,  end: 'processed', amt: 4500 },
    { su: 7,  co: 6,    hu: 4,    re: 8,    da: 4,    cat: 'Monitors',          q: 3,  un: 'pieces', wt: 18,   ago: 28,  end: 'processed', amt: 1080 },
    { su: 9,  co: 7,    hu: 2,    re: 9,    da: 6,    cat: 'Electronic Cables', q: 10, un: 'kg',     wt: 10,   ago: 30,  end: 'processed', amt: 550  },
    { su: 11, co: 8,    hu: 5,    re: 1,    da: 7,    cat: 'Keyboards & Mouse', q: 8,  un: 'pieces', wt: 4,    ago: 33,  end: 'processed', amt: 1280 },
    { su: 0,  co: 9,    hu: 3,    re: 2,    da: 1,    cat: 'Circuit Boards',    q: 4,  un: 'pieces', wt: 5,    ago: 37,  end: 'processed', amt: 2250 },

    // ─── EcoCycle (re=0) demo boost — makes the Recycler dashboard busy ───
    // Login:  ops@ecocycle.in / recycler123
    // Split across all 4 relevant lifecycle buckets this recycler can see.
    // matched (4) — awaiting EcoCycle to assign a delivery agent
    { su: 0,  co: 0, hu: 0, re: 0, da: null, cat: 'Mobile Phones',     q: 15, un: 'pieces', wt: 3,  ago: 0.8, end: 'matched' },
    { su: 1,  co: 1, hu: 1, re: 0, da: null, cat: 'Old Laptops',       q: 4,  un: 'pieces', wt: 12, ago: 1.2, end: 'matched' },
    { su: 4,  co: 2, hu: 2, re: 0, da: null, cat: 'Monitors',          q: 3,  un: 'pieces', wt: 15, ago: 1.6, end: 'matched' },
    { su: 6,  co: 3, hu: 3, re: 0, da: null, cat: 'Circuit Boards',    q: 10, un: 'pieces', wt: 6,  ago: 2.0, end: 'matched' },

    // in_transit (2) — EcoCycle already dispatched an agent
    { su: 7,  co: 4, hu: 4, re: 0, da: 2,    cat: 'Batteries',         q: 30, un: 'pieces', wt: 12, ago: 2.5, end: 'in_transit' },
    { su: 9,  co: 5, hu: 5, re: 0, da: 6,    cat: 'Old Laptops',       q: 6,  un: 'pieces', wt: 18, ago: 3.2, end: 'in_transit' },

    // delivered (3) — at EcoCycle, awaiting admin to record payment
    { su: 10, co: 6, hu: 0, re: 0, da: 3,    cat: 'Mobile Phones',     q: 25, un: 'pieces', wt: 5,  ago: 6,   end: 'delivered' },
    { su: 11, co: 7, hu: 1, re: 0, da: 5,    cat: 'Monitors',          q: 4,  un: 'pieces', wt: 20, ago: 8,   end: 'delivered' },
    { su: 2,  co: 8, hu: 2, re: 0, da: 7,    cat: 'Electronic Cables', q: 12, un: 'kg',     wt: 12, ago: 10,  end: 'delivered' },

    // processed (3) — payment collected, closed out
    { su: 3,  co: 9, hu: 3, re: 0, da: 8,    cat: 'Keyboards & Mouse', q: 15, un: 'pieces', wt: 7,  ago: 15,  end: 'processed', amt: 2400 },
    { su: 5,  co: 0, hu: 4, re: 0, da: 9,    cat: 'Printers',          q: 3,  un: 'pieces', wt: 18, ago: 19,  end: 'processed', amt: 950  },
    { su: 8,  co: 1, hu: 5, re: 0, da: 2,    cat: 'Circuit Boards',    q: 8,  un: 'pieces', wt: 5,  ago: 25,  end: 'processed', amt: 1750 },
  ];

  const ORDER = ['submitted', 'assigned', 'collected', 'at_hub', 'verified', 'matched', 'in_transit', 'delivered', 'processed'];
  const INV_AT = {
    submitted: 'submitted', assigned: 'submitted', collected: 'collected', at_hub: 'at_hub',
    verified: 'verified',   matched: 'matched',    in_transit: 'in_transit',
    delivered: 'delivered', processed: 'processed',
  };

  for (const s of scenarios) {
    const u  = smallUsers[s.su];
    const co = s.co != null ? collectors[s.co] : null;
    const hu = s.hu != null ? hubs[s.hu] : null;
    const re = s.re != null ? recyclers[s.re] : null;
    const da = s.da != null ? deliveryAgents[s.da] : null;
    if (!u) continue;

    const base = Date.now() - s.ago * 24 * 60 * 60 * 1000;
    const at = (hours) => new Date(base + hours * 60 * 60 * 1000).toISOString();
    const endIdx = ORDER.indexOf(s.end);
    const intentId = generateId();
    const invId = generateId();

    const intentStatus = endIdx >= 2 ? 'collected' : s.end;
    intents.push({
      _id: intentId,
      userId: u._id,
      type: 'small_user',
      items: [{ category: s.cat, estimatedQty: s.q, unit: s.un, photos: [], condition: 'used' }],
      status: intentStatus,
      assignedCollector: co?._id || null,
      location: { ...u.location },
      createdAt: at(0),
      updatedAt: at(Math.max(0, endIdx * 8)),
    });

    const trace = [{ actor: u._id, actorName: u.name, action: 'submitted', timestamp: at(0) }];
    if (endIdx >= 1 && co) trace.push({ actor: co._id, actorName: co.name, action: 'assigned_to_collector', timestamp: at(6) });
    if (endIdx >= 2 && co) trace.push({ actor: co._id, actorName: co.name, action: 'collected', timestamp: at(8) });
    if (endIdx >= 3 && co) trace.push({ actor: co._id, actorName: co.name, action: 'delivered_to_hub', timestamp: at(12) });
    if (endIdx >= 4 && hu) trace.push({ actor: hu._id, actorName: hu.name, action: 'verified_at_hub', timestamp: at(36) });
    if (endIdx >= 5 && re) trace.push({ actor: admin._id, actorName: admin.name, action: 'assigned_to_recycler', note: re.name, timestamp: at(48) });
    if (endIdx >= 6 && da) trace.push({ actor: da._id, actorName: da.name, action: 'picked_up_from_hub', timestamp: at(60) });
    if (endIdx >= 7 && da) trace.push({ actor: da._id, actorName: da.name, action: 'delivered_to_recycler', timestamp: at(72) });
    if (endIdx >= 8)       trace.push({ actor: admin._id, actorName: admin.name, action: 'payment_collected', note: `₹${s.amt || 0} via bank_transfer`, timestamp: at(80) });

    inventory.push({
      _id: invId,
      qrCode: generateQRCode(invId),
      intentId,
      category: s.cat,
      actualQty: s.q,
      claimedQty: s.q,
      claimedCategory: s.cat,
      unit: s.un,
      weightKg: endIdx >= 4 ? s.wt : null,
      condition: 'used',
      status: INV_AT[s.end],
      sourceUserId: u._id,
      collectorId: co?._id || null,
      hubId: hu?._id || null,
      deliveryWorkerId: da?._id || null,
      recyclerId: re?._id || null,
      matchedDemandId: null,
      verificationPhotos: [],
      traceability: trace,
      collectionId: endIdx >= 2
        ? `P${new Date(base).toISOString().slice(0,10).replace(/-/g,'')}${String(100 + Math.floor(Math.random() * 899))}`
        : undefined,
      hubVerifiedAt: endIdx >= 4 ? at(36) : undefined,
      processedAt:   endIdx >= 8 ? at(80) : undefined,
      createdAt: at(0),
      updatedAt: trace[trace.length - 1].timestamp,
    });

    if (endIdx >= 6 && da && hu && re) {
      const delStatus = endIdx >= 7 ? 'delivered' : 'picked_up';
      deliveries.push({
        _id: generateId(),
        deliveryWorkerId: da._id,
        pickupHub: hu._id,
        dropoffRecycler: re._id,
        manifest: [{ inventoryId: invId, qrCode: inventory[inventory.length - 1].qrCode, category: s.cat, qty: s.q, unit: s.un, weightKg: s.wt }],
        status: delStatus,
        pickupProof:  { qrScanned: true, scannedCount: 1, photo: '', timestamp: at(60) },
        dropoffProof: endIdx >= 7
          ? { qrScanned: true, scannedCount: 1, photo: '', timestamp: at(72) }
          : { qrScanned: false },
        createdAt: at(54),
        updatedAt: at(endIdx >= 7 ? 72 : 60),
      });
    }

    if (endIdx >= 8 && re) {
      payments.push({
        _id: generateId(),
        inventoryId: invId,
        recyclerId: re._id,
        collectedBy: admin._id,
        amount: s.amt || 0,
        method: 'bank_transfer',
        note: `Payment for ${s.cat}`,
        status: 'collected',
        createdAt: at(80),
      });

      // Award reward points to source user (100%), collector (50%), hub (30%)
      const basePts = s.un === 'kg' ? Math.floor(s.q) : s.q * 5;
      const awards = [
        { userId: u._id, pts: basePts, reason: 'item_processed_source' },
        co && { userId: co._id, pts: Math.max(1, Math.round(basePts * 0.5)), reason: 'item_processed_collector' },
        hu && { userId: hu._id, pts: Math.max(1, Math.round(basePts * 0.3)), reason: 'item_processed_hub' },
      ].filter(Boolean);
      for (const a of awards) {
        const r = rewards.find((x) => x.userId === a.userId);
        if (!r) continue;
        r.totalPoints += a.pts;
        r.history.push({ action: a.reason, points: a.pts, inventoryId: invId, timestamp: at(80) });
        r.updatedAt = at(80);
      }
    }
  }
}

async function topUpHubs() {
  for (const h of CANONICAL_HUBS) {
    const existing = users.find((u) => u.email.toLowerCase() === h.email.toLowerCase());
    if (existing) {
      // Upgrade shape for users who seeded with the older address format
      existing.name = h.name;
      existing.role = 'hub';
      existing.trustLevel = 'high';
      existing.isActive = true;
      existing.phone = h.phone;
      existing.location = { lat: h.lat, lng: h.lng, address: h.address };
      existing.updatedAt = new Date().toISOString();
    } else {
      const hashed = await hashPassword('hub123');
      const id = generateId();
      users.push({
        _id: id,
        name: h.name,
        email: h.email,
        password: hashed,
        phone: h.phone,
        role: 'hub',
        trustLevel: 'high',
        location: { lat: h.lat, lng: h.lng, address: h.address },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      rewards.push({
        _id: generateId(),
        userId: id,
        totalPoints: 0,
        currentStreak: 0,
        badges: [],
        milestones: [
          { threshold: 100, reached: false, rewardType: 'bronze' },
          { threshold: 500, reached: false, rewardType: 'silver' },
          { threshold: 1000, reached: false, rewardType: 'gold' },
          { threshold: 5000, reached: false, rewardType: 'platinum' },
        ],
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export async function seedDatabase({ force = false } = {}) {
  try {
    if (!force && users.length > 0) {
      console.log(`📂 JSON store already has ${users.length} users — topping up hubs if needed…`);
      await topUpHubs();
      flushAll();
      return;
    }

    console.log('🌱 Seeding JSON store with team data...');

    // Wipe in-memory arrays (and therefore the JSON files after flush)
    users.length = 0;
    rewards.length = 0;
    intents.length = 0;
    inventory.length = 0;
    demands.length = 0;
    deliveries.length = 0;
    disputes.length = 0;
    notifications.length = 0;
    payments.length = 0;

    const trustFor = (role) =>
      role === 'admin'
        ? 'highest'
        : role === 'hub' || role === 'recycler' || role === 'bulk_generator'
          ? 'high'
          : role === 'local_collector'
            ? 'medium'
            : 'low';

    async function createUser({ name, email, role, phone, lat, lng, address, password = 'pass1234', extra = {} }) {
      const hashed = await hashPassword(password);
      const user = {
        _id: generateId(),
        name,
        email: email.toLowerCase(),
        password: hashed,
        phone,
        role,
        trustLevel: trustFor(role),
        location: { lat, lng, address },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...extra,
      };
      users.push(user);
      return user;
    }

    function createReward(userId) {
      const r = {
        _id: generateId(),
        userId,
        totalPoints: 0,
        currentStreak: 0,
        badges: [],
        milestones: [
          { threshold: 100, reached: false, rewardType: 'bronze' },
          { threshold: 500, reached: false, rewardType: 'silver' },
          { threshold: 1000, reached: false, rewardType: 'gold' },
          { threshold: 5000, reached: false, rewardType: 'platinum' },
        ],
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      rewards.push(r);
      return r;
    }

    // ─── Admin ─────────────────────────────────────────────────────────────
    const admin = await createUser({
      name: 'Rohit Ritthe',
      email: 'rohit.ritthe@ewaste.com',
      role: 'admin',
      phone: '+91-9000000001',
      lat: 18.5204,
      lng: 73.8567,
      address: 'Shivaji Nagar, Pune',
      password: 'admin123',
    });

    // ─── Small Users (12) ──────────────────────────────────────────────────
    const smallUsersSeed = [
      { name: 'Hrithik Sharma',    email: 'hrithik@ewaste.com',         lat: 18.5314, lng: 73.8446, address: 'B-204, Ideal Colony, Kothrud, Pune 411038' },
      { name: 'Kaushal Patil',     email: 'kaushal@ewaste.com',         lat: 18.5678, lng: 73.9143, address: 'Flat 7, Nyati Empire, Viman Nagar, Pune 411014' },
      { name: 'Tejas Shinde',      email: 'tejas.shinde@ewaste.com',    lat: 18.5089, lng: 73.8285, address: 'Row House 12, Karve Nagar, Pune 411052' },
      { name: 'Suraj Salunkhe',    email: 'suraj.salunkhe@ewaste.com',  lat: 18.4575, lng: 73.8508, address: 'Sai Prasad Bldg, Sinhagad Road, Pune 411051' },
      { name: 'Shubham Lohar',     email: 'shubham.lohar@ewaste.com',   lat: 18.5912, lng: 73.7389, address: 'A-1402, Life Republic, Hinjewadi Phase 3, Pune 411057' },
      { name: 'Anita Kulkarni',    email: 'anita.kulkarni@ewaste.com',  lat: 18.5089, lng: 73.8553, address: 'Sr. No. 45/2, Sadashiv Peth, Pune 411030' },
      { name: 'Rahul Joshi',       email: 'rahul.joshi@ewaste.com',     lat: 18.5633, lng: 73.8997, address: 'Flat 3C, Clover Park, Kalyani Nagar, Pune 411006' },
      { name: 'Pooja Desai',       email: 'pooja.desai@ewaste.com',     lat: 18.5209, lng: 73.8568, address: 'Plot 5, Model Colony, Shivaji Nagar, Pune 411016' },
      { name: 'Nikhil Mehta',      email: 'nikhil.mehta@ewaste.com',    lat: 18.4983, lng: 73.8956, address: 'A-502, Magarpatta City, Hadapsar, Pune 411028' },
      { name: 'Snehal Rao',        email: 'snehal.rao@ewaste.com',      lat: 18.5723, lng: 73.7805, address: 'Row 4, Balewadi High Street, Balewadi, Pune 411045' },
      { name: 'Ajay Bhosale',      email: 'ajay.bhosale@ewaste.com',    lat: 18.4698, lng: 73.8284, address: 'Flat 11, Parvati Darshan, Parvati, Pune 411009' },
      { name: 'Isha Nair',         email: 'isha.nair@ewaste.com',       lat: 18.5429, lng: 73.7908, address: 'B-801, Marvel Izara, Bavdhan, Pune 411021' },
    ];
    const smallUsers = [];
    for (let i = 0; i < smallUsersSeed.length; i++) {
      const u = await createUser({
        ...smallUsersSeed[i],
        role: 'small_user',
        phone: `+91-98${String(20000000 + i).padStart(8, '0')}`,
        password: 'user123',
      });
      createReward(u._id);
      smallUsers.push(u);
    }

    // ─── Local Collectors (10) ─────────────────────────────────────────────
    const collectorsSeed = [
      { name: 'Sahil Wankhede',  email: 'sahil.wankhede@ewaste.com',  lat: 18.5255, lng: 73.8500, address: 'Shop 3, JM Road, Deccan Gymkhana, Pune 411004' },
      { name: 'Rohan Pawar',     email: 'rohan.pawar@ewaste.com',     lat: 18.5646, lng: 73.7769, address: 'Lane 7, Baner Road, Baner, Pune 411045' },
      { name: 'Aniket Jagtap',   email: 'aniket.jagtap@ewaste.com',   lat: 18.4982, lng: 73.8301, address: 'Shop 22, Warje Chowk, Warje, Pune 411058' },
      { name: 'Prasad More',     email: 'prasad.more@ewaste.com',     lat: 18.5704, lng: 73.9085, address: 'Galli 4, Vishrantwadi, Pune 411015' },
      { name: 'Sandeep Ghule',   email: 'sandeep.ghule@ewaste.com',   lat: 18.5117, lng: 73.9305, address: 'Unit 9, Fursungi Road, Hadapsar, Pune 411028' },
      { name: 'Omkar Bagal',     email: 'omkar.bagal@ewaste.com',     lat: 18.5847, lng: 73.8180, address: 'Row 2, Pashan-Sus Road, Pashan, Pune 411021' },
      { name: 'Vishal Mohite',   email: 'vishal.mohite@ewaste.com',   lat: 18.5068, lng: 73.8711, address: 'Lane 1, Bibwewadi Main Road, Bibwewadi, Pune 411037' },
      { name: 'Mayur Sonar',     email: 'mayur.sonar@ewaste.com',     lat: 18.5924, lng: 73.8720, address: 'Shop 8, Yerawada Main Street, Yerawada, Pune 411006' },
      { name: 'Kiran Borade',    email: 'kiran.borade@ewaste.com',    lat: 18.6024, lng: 73.7584, address: 'Plot 17, Wakad Bus Stop, Wakad, Pune 411057' },
      { name: 'Tushar Sawant',   email: 'tushar.sawant@ewaste.com',   lat: 18.4521, lng: 73.8634, address: 'Sai Colony, Dhankawadi, Pune 411043' },
    ];
    const collectors = [];
    for (let i = 0; i < collectorsSeed.length; i++) {
      const u = await createUser({
        ...collectorsSeed[i],
        role: 'local_collector',
        phone: `+91-97${String(20000000 + i).padStart(8, '0')}`,
        password: 'collector123',
      });
      createReward(u._id);
      collectors.push(u);
    }

    // ─── Hubs (4, upserted by email) ───────────────────────────────────────
    // `topUpHubs()` creates the full-address canonical hubs (A, B, C, D).
    await topUpHubs();
    const hubs = users.filter((u) => u.role === 'hub');

    // ─── Delivery Agents (10) ──────────────────────────────────────────────
    const deliverySeed = [
      { name: 'Ajit Mane',         email: 'ajit.mane@ewaste.com',         lat: 18.5158, lng: 73.8572, address: 'Camp Area, MG Road, Pune 411001' },
      { name: 'Prathamesh Kale',   email: 'prathamesh.kale@ewaste.com',   lat: 18.5590, lng: 73.7868, address: 'Pashan-Sus Road, Pashan, Pune 411021' },
      { name: 'Akash Patole',      email: 'akash.patole@ewaste.com',      lat: 18.4927, lng: 73.8513, address: 'Parvati Paytha, Pune 411009' },
      { name: 'Rohit Lokhande',    email: 'rohit.lokhande@ewaste.com',    lat: 18.5812, lng: 73.9008, address: 'Kalyani Nagar Phase 2, Pune 411006' },
      { name: 'Swapnil Kadam',     email: 'swapnil.kadam@ewaste.com',     lat: 18.5331, lng: 73.8147, address: 'Karve Road, Kothrud Depot, Pune 411038' },
      { name: 'Chetan Salvi',      email: 'chetan.salvi@ewaste.com',      lat: 18.6011, lng: 73.7611, address: 'Wakad Bridge, Wakad, Pune 411057' },
      { name: 'Nitin Pisal',       email: 'nitin.pisal@ewaste.com',       lat: 18.5088, lng: 73.9270, address: 'Magarpatta Gate 3, Hadapsar, Pune 411028' },
      { name: 'Dinesh Pandit',     email: 'dinesh.pandit@ewaste.com',     lat: 18.5710, lng: 73.7820, address: 'Balewadi Phata, Balewadi, Pune 411045' },
      { name: 'Mahesh Ghadge',     email: 'mahesh.ghadge@ewaste.com',     lat: 18.4602, lng: 73.8450, address: 'Katraj Kondhwa Road, Katraj, Pune 411046' },
      { name: 'Yogesh Rathod',     email: 'yogesh.rathod@ewaste.com',     lat: 18.5922, lng: 73.8729, address: 'Yerawada Market, Yerawada, Pune 411006' },
    ];
    const deliveryAgents = [];
    for (let i = 0; i < deliverySeed.length; i++) {
      const u = await createUser({
        ...deliverySeed[i],
        role: 'delivery_worker',
        phone: `+91-95${String(20000000 + i).padStart(8, '0')}`,
        password: 'delivery123',
        extra: { reliabilityScore: 90 },
      });
      deliveryAgents.push(u);
    }

    // ─── Recycler companies (10) ───────────────────────────────────────────
    const recyclersSeed = [
      {
        name: 'EcoCycle Recyclers Pvt Ltd', email: 'ops@ecocycle.in',
        lat: 18.6465, lng: 73.7699,
        address: 'Unit 14, Talegaon Industrial Area, MIDC Phase 2, Pune 410507',
        extra: { companyName: 'EcoCycle Recyclers Pvt Ltd', license: 'CPCB-MH/2023/EW-014', ratePerKg: 48 },
      },
      {
        name: 'GreenMetal Industries', email: 'procurement@greenmetal.in',
        lat: 18.6758, lng: 73.9283,
        address: 'Plot 7, Chakan MIDC Phase 1, Chakan, Pune 410501',
        extra: { companyName: 'GreenMetal Industries', license: 'CPCB-MH/2022/EW-031', ratePerKg: 55 },
      },
      {
        name: 'ReNewTech Solutions', email: 'sales@renewtech.io',
        lat: 18.4088, lng: 73.9265,
        address: 'A-3, Phursungi IT Park, Saswad Road, Pune 412308',
        extra: { companyName: 'ReNewTech Solutions', license: 'CPCB-MH/2024/EW-007', ratePerKg: 52 },
      },
      {
        name: 'Vasundhara E-Waste Pvt Ltd', email: 'contact@vasundhara-ewaste.in',
        lat: 18.6229, lng: 73.8019,
        address: 'Shed 22, Bhosari MIDC, Pimpri-Chinchwad, Pune 411026',
        extra: { companyName: 'Vasundhara E-Waste Pvt Ltd', license: 'CPCB-MH/2021/EW-046', ratePerKg: 50 },
      },
      {
        name: 'Triveni Recycling', email: 'ops@trivenirecycling.in',
        lat: 18.6822, lng: 73.7945,
        address: 'Gat No. 318, Alandi Road, Chakan, Pune 410501',
        extra: { companyName: 'Triveni Recycling', license: 'CPCB-MH/2023/EW-059', ratePerKg: 46 },
      },
      {
        name: 'CircuitLoop Industries', email: 'hello@circuitloop.co',
        lat: 18.6612, lng: 73.8020,
        address: 'Plot 16, Pimpri Industrial Estate, Pimpri, Pune 411018',
        extra: { companyName: 'CircuitLoop Industries', license: 'CPCB-MH/2024/EW-022', ratePerKg: 58 },
      },
      {
        name: 'EcoRevive Resources', email: 'info@ecorevive.in',
        lat: 18.5891, lng: 73.9701,
        address: 'Unit 5, Ranjangaon MIDC, Shirur Taluka, Pune 412220',
        extra: { companyName: 'EcoRevive Resources', license: 'CPCB-MH/2023/EW-077', ratePerKg: 54 },
      },
      {
        name: 'MetalMine Recyclers', email: 'procurement@metalmine.co.in',
        lat: 18.4352, lng: 73.9468,
        address: 'Gate 4, Uruli Kanchan Industrial Area, Pune 412202',
        extra: { companyName: 'MetalMine Recyclers', license: 'CPCB-MH/2022/EW-102', ratePerKg: 60 },
      },
      {
        name: 'PlasticPulse Solutions', email: 'business@plasticpulse.in',
        lat: 18.5348, lng: 73.9956,
        address: 'Unit 12, Kharadi EPIP, Kharadi, Pune 411014',
        extra: { companyName: 'PlasticPulse Solutions', license: 'CPCB-MH/2024/EW-130', ratePerKg: 42 },
      },
      {
        name: 'Saksham Green Tech', email: 'orders@sakshamgreen.in',
        lat: 18.6085, lng: 73.8435,
        address: 'Plot 3, Bhosari Chowk, Bhosari, Pune 411039',
        extra: { companyName: 'Saksham Green Tech', license: 'CPCB-MH/2023/EW-088', ratePerKg: 53 },
      },
    ];
    const recyclers = [];
    for (let i = 0; i < recyclersSeed.length; i++) {
      const u = await createUser({
        ...recyclersSeed[i],
        role: 'recycler',
        phone: `+91-80${String(20000000 + i).padStart(8, '0')}`,
        password: 'recycler123',
      });
      recyclers.push(u);
    }

    // ─── Recycler demands (so admin can route items) ───────────────────────
    const categories = ['Laptops', 'Mobile Phones', 'Cables', 'Monitors', 'Batteries'];
    for (const r of recyclers) {
      for (let j = 0; j < 2; j++) {
        demands.push({
          _id: generateId(),
          recyclerId: r._id,
          category: categories[(categories.indexOf('Laptops') + j + recyclers.indexOf(r)) % categories.length],
          quantityNeeded: 50 + j * 30,
          unit: 'pieces',
          deliveryWindow: {
            start: new Date().toISOString(),
            end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          },
          status: 'open',
          matchedInventory: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // ─── Mock activity: 16 intents across all 9 lifecycle states ──────────
    await generateMockActivity({
      admin,
      smallUsers,
      collectors,
      hubs,
      deliveryAgents,
      recyclers,
    });

    // ─── Sample disputes (5: a mix of open + resolved across roles) ───────
    const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
    const verifiedItem = inventory.find((i) => i.status === 'verified');
    const atHubItem = inventory.find((i) => i.status === 'at_hub');
    const deliveredItem = inventory.find((i) => i.status === 'delivered');

    disputes.push(
      {
        _id: generateId(),
        raisedBy: smallUsers[1]._id,
        against: collectors[0]._id,
        inventoryId: verifiedItem?._id || null,
        type: 'quantity_mismatch',
        description: 'Collector picked up only 3 laptops but I had submitted 4. Please investigate.',
        evidence: [],
        status: 'open',
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
      },
      {
        _id: generateId(),
        raisedBy: recyclers[0]._id,
        against: deliveryAgents[0]._id,
        inventoryId: deliveredItem?._id || null,
        type: 'damaged_item',
        description: 'One monitor arrived with a cracked screen. Photo evidence attached offline.',
        evidence: [],
        status: 'resolved',
        resolvedBy: admin._id,
        resolution: 'Recycler agreed to 10% price adjustment for the damaged unit. Delivery agent briefed.',
        createdAt: daysAgo(6),
        updatedAt: daysAgo(5),
      },
      {
        _id: generateId(),
        raisedBy: hubs[2]._id,
        against: collectors[3]._id,
        inventoryId: atHubItem?._id || null,
        type: 'quality_mismatch',
        description: 'Received "working" condition items but 2 were clearly damaged on arrival at hub.',
        evidence: [],
        status: 'open',
        createdAt: daysAgo(3),
        updatedAt: daysAgo(3),
      },
      {
        _id: generateId(),
        raisedBy: smallUsers[9]._id,
        against: collectors[6]._id,
        inventoryId: null,
        type: 'non_delivery',
        description: 'Collector accepted my request 4 days ago but never came. Please reassign.',
        evidence: [],
        status: 'resolved',
        resolvedBy: admin._id,
        resolution: 'Collector dropped; request reassigned to Kiran Borade. Trust level lowered.',
        createdAt: daysAgo(4),
        updatedAt: daysAgo(3),
      },
      {
        _id: generateId(),
        raisedBy: recyclers[3]._id,
        against: deliveryAgents[4]._id,
        inventoryId: null,
        type: 'other',
        description: 'Delivery was 3 hours late without prior notice. Coordination needs improvement.',
        evidence: [],
        status: 'open',
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
      },
    );

    // ─── Notifications (20+ across every active role) ──────────────────────
    const nowIso = new Date().toISOString();
    const recentIso = (mins) => new Date(Date.now() - mins * 60 * 1000).toISOString();
    const makeNote = (userId, title, message, type = 'info', createdAt = nowIso) => ({
      _id: generateId(),
      userId,
      title,
      message,
      type,
      relatedId: null,
      read: false,
      createdAt,
    });

    notifications.push(
      // Small users
      makeNote(smallUsers[0]._id, 'Pickup accepted',       `${collectors[1].name} will collect your e-waste shortly.`, 'pickup_accepted', recentIso(15)),
      makeNote(smallUsers[3]._id, 'Reward points earned',  'Your contribution of 3 Monitors has been processed. +15 pts', 'item_processed', recentIso(120)),
      makeNote(smallUsers[4]._id, 'Big reward earned',     'Your 5 laptops (15 kg) is fully processed. +25 pts credited', 'item_processed', recentIso(300)),
      makeNote(smallUsers[7]._id, 'Items verified at hub', `${hubs[3].name} verified your 10 mobile phones.`, 'info', recentIso(420)),
      makeNote(smallUsers[9]._id, 'Dispute resolved',      'Your non-delivery dispute has been resolved. Reassigned to a new collector.', 'dispute_resolved', daysAgo(3)),

      // Collectors
      makeNote(collectors[0]._id, 'New pickup nearby',     `${smallUsers[0].name} in Kothrud requested a pickup (~1.2 km).`, 'pickup_request', recentIso(10)),
      makeNote(collectors[2]._id, 'New pickup nearby',     `${smallUsers[1].name} in Viman Nagar requested 4 kg of cables.`, 'pickup_request', recentIso(30)),
      makeNote(collectors[4]._id, 'New pickup nearby',     `${smallUsers[5].name} in Sadashiv Peth listed 2 monitors.`, 'pickup_request', recentIso(60)),
      makeNote(collectors[1]._id, 'Reward milestone',      'You crossed 50 reward points this week.', 'info', recentIso(240)),
      makeNote(collectors[5]._id, 'Reward points earned',  '+13 pts from processed laptops.', 'item_processed', recentIso(720)),
      makeNote(collectors[8]._id, 'New manual assignment', `Admin assigned a batch of Batteries to you.`, 'manual_assignment', recentIso(90)),

      // Hubs
      makeNote(hubs[0]._id, 'Incoming shipment',           `${collectors[0].name} delivered 6 keyboards — please verify.`, 'incoming_shipment', recentIso(45)),
      makeNote(hubs[2]._id, 'Incoming shipment',           `${collectors[1].name} delivered 12 batteries — please verify.`, 'incoming_shipment', recentIso(75)),
      makeNote(hubs[4]._id, 'Incoming shipment',           `${collectors[3].name} delivered 8 circuit boards.`, 'incoming_shipment', recentIso(120)),
      makeNote(hubs[1]._id, 'Reward points earned',        '+8 pts from processed batch.', 'item_processed', daysAgo(1)),

      // Recyclers
      makeNote(recyclers[0]._id, 'New order from admin',   '2 monitors allocated to you — assign a delivery agent.', 'order_assigned', recentIso(25)),
      makeNote(recyclers[3]._id, 'New order from admin',   '2 laptops allocated to you — assign a delivery agent.', 'order_assigned', recentIso(40)),
      makeNote(recyclers[5]._id, 'New order from admin',   '15 batteries allocated to you — assign a delivery agent.', 'order_assigned', recentIso(55)),
      makeNote(recyclers[1]._id, 'Shipment arriving soon', `${deliveryAgents[0].name} picked up 3 monitors from Hub A.`, 'shipment_dispatched', recentIso(85)),
      makeNote(recyclers[6]._id, 'Shipment arriving soon', `${deliveryAgents[1].name} picked up 20 mobile phones from Hub C.`, 'shipment_dispatched', recentIso(150)),

      // Delivery agents
      makeNote(deliveryAgents[0]._id, 'New delivery task', `${recyclers[0].name} assigned you 2 monitors to pick up.`, 'delivery_assigned', recentIso(20)),
      makeNote(deliveryAgents[3]._id, 'New delivery task', `${recyclers[2].name} assigned you 4 laptops to pick up.`, 'delivery_assigned', recentIso(50)),
      makeNote(deliveryAgents[1]._id, 'Delivery completed', 'Your 20 mobile phones drop-off has been acknowledged.', 'info', daysAgo(2)),

      // Admin — inbox of things needing approval
      makeNote(admin._id, 'Hub verified batch ready',  'Hub B verified 3 laptops — awaiting your approval.', 'hub_verified',     recentIso(5)),
      makeNote(admin._id, 'Hub verified batch ready',  'Hub D verified 10 mobile phones — awaiting approval.', 'hub_verified',  recentIso(35)),
      makeNote(admin._id, 'Hub verified batch ready',  'Hub F verified 6 kg cables — awaiting approval.', 'hub_verified',       recentIso(65)),
      makeNote(admin._id, 'Delivery complete — pay',   `3 items delivered by ${deliveryAgents[0].name}. Record payment to finalise.`, 'delivery_complete', recentIso(180)),
      makeNote(admin._id, 'Dispute filed',             `${smallUsers[1].name} raised a quantity-mismatch dispute.`, 'dispute_opened', daysAgo(2)),
      makeNote(admin._id, 'Dispute filed',             `${hubs[2].name} raised a quality-mismatch dispute.`, 'dispute_opened', daysAgo(3)),
    );

    // Flush everything to disk immediately
    flushAll();

    console.log('✅ Seed complete.');
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TEST CREDENTIALS (all share the per-role password below)
 Every role now has multiple accounts — any one works.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Admin  (1)                 rohit.ritthe@ewaste.com          admin123
 Small  (12)                hrithik@ewaste.com               user123
                            kaushal@ewaste.com               user123
                            tejas.shinde@ewaste.com          user123
                            suraj.salunkhe@ewaste.com        user123
                            shubham.lohar@ewaste.com         user123
                            anita.kulkarni@ewaste.com        user123
                            rahul.joshi@ewaste.com           user123
                            pooja.desai@ewaste.com           user123
                            nikhil.mehta@ewaste.com          user123
                            snehal.rao@ewaste.com            user123
                            ajay.bhosale@ewaste.com          user123
                            isha.nair@ewaste.com             user123
 Collectors (10)            sahil.wankhede@ewaste.com        collector123
                            rohan.pawar@ewaste.com           collector123
                            aniket.jagtap@ewaste.com         collector123
                            prasad.more@ewaste.com           collector123
                            sandeep.ghule@ewaste.com         collector123
                            omkar.bagal@ewaste.com           collector123
                            vishal.mohite@ewaste.com         collector123
                            mayur.sonar@ewaste.com           collector123
                            kiran.borade@ewaste.com          collector123
                            tushar.sawant@ewaste.com         collector123
 Hubs (6)                   vedant.rane@ewaste.com           hub123
                            vipul.ware@ewaste.com            hub123
                            aditya.joshi@ewaste.com          hub123
                            neha.deshmukh@ewaste.com         hub123
                            amol.gaikwad@ewaste.com          hub123
                            siddharth.kamble@ewaste.com      hub123
 Delivery (10)              ajit.mane@ewaste.com             delivery123
                            prathamesh.kale@ewaste.com       delivery123
                            akash.patole@ewaste.com          delivery123
                            rohit.lokhande@ewaste.com        delivery123
                            swapnil.kadam@ewaste.com         delivery123
                            chetan.salvi@ewaste.com          delivery123
                            nitin.pisal@ewaste.com           delivery123
                            dinesh.pandit@ewaste.com         delivery123
                            mahesh.ghadge@ewaste.com         delivery123
                            yogesh.rathod@ewaste.com         delivery123
 Recyclers (10)             ops@ecocycle.in                  recycler123
                            procurement@greenmetal.in        recycler123
                            sales@renewtech.io               recycler123
                            contact@vasundhara-ewaste.in     recycler123
                            ops@trivenirecycling.in          recycler123
                            hello@circuitloop.co             recycler123
                            info@ecorevive.in                recycler123
                            procurement@metalmine.co.in      recycler123
                            business@plasticpulse.in         recycler123
                            orders@sakshamgreen.in           recycler123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Activity seeded:
   Intents      37      Inventory items   37
   Deliveries   18      Payments           8
   Disputes      5      Notifications     29
 Note: EcoCycle (ops@ecocycle.in) has an extra-rich demo dashboard.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase({ force: true });
}
