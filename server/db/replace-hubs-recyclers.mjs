/**
 * Replace demo hubs/recyclers with real Maharashtra companies (DESTRUCTIVE).
 *  - Wipes all transactional tables + deletes existing hub/recycler users.
 *  - Inserts real companies (geocoded; missing phone -> demo number; password Test@1234).
 *  - Keeps small_user / local_collector / delivery_worker / admin accounts.
 *
 *   node server/db/replace-hubs-recyclers.mjs
 */
import 'dotenv/config';
import { pool } from '../lib/db.js';
import { hashPassword } from '../utils/helpers.js';

const PW = 'Test@1234';
const pad = (n, w) => String(n).padStart(w, '0');
const d0 = new Date();
const PERIOD = `${d0.getFullYear()}${pad(d0.getMonth() + 1, 2)}`;

const CITY_CENTER = {
  Mumbai: { lat: 19.0760, lng: 72.8777 },
  'Navi Mumbai': { lat: 19.0330, lng: 73.0297 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  'Pimpri-Chinchwad': { lat: 18.6298, lng: 73.7997 },
  Nagpur: { lat: 21.1458, lng: 79.0882 },
  'Chhatrapati Sambhajinagar': { lat: 19.8762, lng: 75.3433 },
  Solapur: { lat: 17.6599, lng: 75.9064 },
  Kolhapur: { lat: 16.7050, lng: 74.2433 },
  Nashik: { lat: 19.9975, lng: 73.7898 },
  Dhule: { lat: 20.9042, lng: 74.7749 },
  _default: { lat: 19.7515, lng: 75.7139 }, // Maharashtra centroid
};

const RECYCLERS = [
  { name: 'Eco Recycling Ltd (Ecoreco)', phone: '+91 22 40052951', address: '422, The Summit Business Bay, Andheri-Kurla Road, Andheri East', city: 'Mumbai' },
  { name: 'Suritex Pvt Ltd', phone: '+91 90499 81347', address: 'Plot B-111, MIDC Butibori', city: 'Nagpur' },
  { name: 'Eco Reset Pvt Ltd', phone: '+91 70218 19071', address: 'Plot 19/1, Mouza Bhowari, Kamptee', city: 'Nagpur' },
  { name: 'Nagraj E-Waste Recycling', phone: '+91 95951 05301', address: 'S.No 41, Vill Asoli, Mouza Mahalgaon, Kamptee 441202', city: 'Nagpur' },
  { name: 'Pune Green Electronic Waste Recycler Pvt Ltd', phone: '+91 99220 71877', address: 'S.No 29/9, Pansare Nagar, Yewlewadi, Haveli', city: 'Pune' },
  { name: 'GNR Recycling India Pvt Ltd', phone: '+91 98223 34823', address: 'S.No 35/4, Dagade Wasti, Pisoli, Haveli', city: 'Pune' },
  { name: 'Green IT Recycling Center Pvt Ltd', phone: null, address: 'Plot D-222, MIDC Ranjangaon 412209', city: 'Pune' },
  { name: 'Green Life E-Waste Recycling Pvt Ltd', phone: '+91 80978 00830', address: 'Plot 11, Gat 40, Karodi', city: 'Chhatrapati Sambhajinagar' },
  { name: 'Perfect E-Waste Recyclers', phone: '+91 98813 81700', address: 'Plot A-8/1, MIDC Chikalthana', city: 'Chhatrapati Sambhajinagar' },
  { name: 'Erecon Recycling Pvt Ltd', phone: '+91 98605 79870', address: 'Gut 94, Chitegaon, Paithan', city: 'Chhatrapati Sambhajinagar' },
  { name: 'ECO Friend Industries', phone: '+91 98211 51069', address: 'Plot A-205, TTC Industrial Area, MIDC Pawane', city: 'Navi Mumbai' },
  { name: 'GNG Electronics Pvt Ltd', phone: '+91 76675 68801', address: 'Plot Gen-2/1/B, D Block, TTC MIDC Turbhe', city: 'Navi Mumbai' },
  { name: 'E-Survival Recycling Pvt Ltd', phone: '+91 98208 02032', address: 'Gut 195/1/B/1, Chincholikati, Mohol', city: 'Solapur' },
  { name: 'Solapur Econ Recyfine', phone: '+91 97630 34875', address: 'Plot K-47, MIDC Chincholi, Mohol 413255', city: 'Solapur' },
  { name: 'Mahesh Traders', phone: '+91 98239 01011', address: 'Plot 316, Shree Shahu Market Yard, Karveer', city: 'Kolhapur' },
  { name: 'Trekomac Refurbs Pvt Ltd', phone: '+91 86526 58017', address: 'Plot G-3, Five Star MIDC Kagal-Hatkanangale, Kagal', city: 'Kolhapur' },
  { name: 'Arihant E Recycling Pvt Ltd', phone: '+91 98203 50406', address: 'Gut 307/1, Shahada Road, Dondaicha, Sindkheda', city: 'Dhule' },
  { name: 'Techeco Waste Management LLP', phone: '+91 1800 889 3121', address: 'Gut No. 155/B/2, Dhakambe', city: 'Nashik' },
  { name: 'Sairakesh India Pvt Ltd', phone: '+91 88880 40666', address: 'NICE Area, MIDC Satpur', city: 'Nashik' },
];

const HUBS = [
  { name: 'Maharashtra Scrap Traders', phone: '+91 91754 69766', address: 'Ambad–Satpur Link Road, Virat Nagar', city: 'Nashik' },
  { name: 'Scrapwale', phone: '+91 70300 00253', address: 'NICE Area, MIDC Satpur', city: 'Nashik' },
  { name: 'Shah Scrap Traders', phone: null, address: 'Ambad–Satpur Link Road', city: 'Nashik' },
  { name: 'Kohinoor Scrap Centre', phone: null, address: 'Ashoka Marg, Gulshan Colony', city: 'Nashik' },
  { name: 'New Kohetoor Traders', phone: '+91 91689 78616', address: 'Dwarka, Pune Road', city: 'Nashik' },
  { name: 'Scrap Wala Kohetoor Traders', phone: '+91 88884 41386', address: 'Mandai Chowk, Old Nashik', city: 'Nashik' },
  { name: 'Zahir Scrap Center', phone: '+91 90281 10553', address: 'Nashik Road', city: 'Nashik' },
  { name: 'Kuldeep E-Waste Disposals', phone: '+91 77339 95555', address: 'Manikmoti Complex, near Reliance Digital, Katraj Chowk 411046', city: 'Pune' },
  { name: 'Roshani Scrap Center', phone: null, address: 'Kudalwadi, Chikhali', city: 'Pimpri-Chinchwad' },
  { name: 'Harshita Green Recyclers', phone: null, address: 'Shukrawar Peth', city: 'Pune' },
  { name: 'Arafat Enterprises', phone: null, address: 'Akurdi', city: 'Pimpri-Chinchwad' },
  { name: 'D D Electronic Equipments Pvt Ltd', phone: null, address: 'Akurdi', city: 'Pimpri-Chinchwad' },
  { name: 'Akanksha Enterprises', phone: null, address: 'MIDC Hingna', city: 'Nagpur' },
  { name: 'Naushad Scrap Mart', phone: null, address: 'Scrap Market', city: 'Nagpur' },
];

let demoSeq = 0;
const demoPhone = () => `+91 90000 ${pad(++demoSeq, 5)}`;
const usedEmails = new Set();
function emailFor(name) {
  let base = name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 40);
  let e = `${base}@ewaste.in`, i = 2;
  while (usedEmails.has(e)) e = `${base}.${i++}@ewaste.in`;
  usedEmails.add(e);
  return e;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function geocode(q) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'ewaste-project-seed/1.0' } });
    if (!r.ok) return null;
    const j = await r.json();
    if (Array.isArray(j) && j[0]) return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) };
  } catch { /* ignore */ }
  return null;
}

async function buildUsers(list, role, prefix, hash) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    let coords = await geocode(`${c.address}, ${c.city}, Maharashtra, India`);
    await sleep(1100); // Nominatim politeness
    if (!coords) {
      const cc = CITY_CENTER[c.city] || CITY_CENTER._default;
      coords = { lat: cc.lat + (i % 7) * 0.004, lng: cc.lng + (i % 5) * 0.004 }; // tiny deterministic spread
    }
    const fullAddr = `${c.address}, ${c.city}, Maharashtra`;
    out.push({
      id: `${prefix}-${PERIOD}${pad(i + 1, 3)}`,
      name: c.name,
      email: emailFor(c.name),
      password: hash,
      phone: c.phone || demoPhone(),
      role,
      trustLevel: 'high',
      location: { lat: coords.lat, lng: coords.lng, address: fullAddr },
    });
    console.log(`  ${role.padEnd(9)} ${out.at(-1).id}  ${c.name}  (${coords.lat.toFixed(3)},${coords.lng.toFixed(3)})`);
  }
  return out;
}

const WIPE_TABLES = [
  'earnings_ledger', 'payments', 'boxes', 'disputes', 'deliveries',
  'notifications', 'rewards', 'recycler_requests', 'inventory', 'demands',
  'usr_req_items', 'category_prices',
];

async function main() {
  const before = (await pool.query(`select role, count(*)::int n from users group by role order by role`)).rows;
  console.log('Users before:', before.map((r) => `${r.role}=${r.n}`).join(' '));

  console.log('\n→ Geocoding + building records (Nominatim, ~1/sec)…');
  const hash = await hashPassword(PW);
  const recyclers = await buildUsers(RECYCLERS, 'recycler', 'RCY', hash);
  const hubs = await buildUsers(HUBS, 'hub', 'HUB', hash);
  const all = [...recyclers, ...hubs];

  const client = await pool.connect();
  try {
    await client.query('begin');
    console.log('\n→ Wiping transactional tables (truncate cascade)…');
    await client.query(`truncate ${WIPE_TABLES.join(', ')} cascade`);
    console.log('→ Deleting old hub/recycler users…');
    await client.query(`delete from users where role in ('hub','recycler')`);
    console.log(`→ Inserting ${all.length} real companies…`);
    const now = new Date().toISOString();
    for (const u of all) {
      await client.query(
        `insert into users (id,name,email,password,phone,role,trust_level,location,avatar_url,is_active,created_at,updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,null,true,$9,$9)`,
        [u.id, u.name, u.email, u.password, u.phone, u.role, u.trustLevel, JSON.stringify(u.location), now]
      );
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  const after = (await pool.query(`select role, count(*)::int n from users group by role order by role`)).rows;
  console.log('\n✅ Done. Users after:', after.map((r) => `${r.role}=${r.n}`).join(' '));
  console.log(`   Hubs + recyclers replaced with ${all.length} real companies. Login any with "${PW}".`);
  await pool.end();
}

main().catch(async (e) => {
  console.error('❌ failed:', e.message);
  try { await pool.end(); } catch {}
  process.exitCode = 1;
});
