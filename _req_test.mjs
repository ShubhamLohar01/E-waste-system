import 'dotenv/config';
import { hydrateAll, flushAll } from './server/lib/pgStore.js';
import { pool } from './server/lib/db.js';
import { recyclerRequests } from './server/models/RecyclerRequest.js';
import { users } from './server/models/User.js';
import { nextId, PREFIX } from './server/utils/idGenerator.js';
import { maskCode } from './server/utils/helpers.js';

let ok = true;
const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) ok = false; };

await hydrateAll();
assert(Array.isArray(recyclerRequests), `recycler_requests hydrated (count=${recyclerRequests.length})`);

const recycler = users.find((u) => u.role === 'recycler');
assert(!!recycler, `found a recycler to attach request to: ${recycler?.name}`);

const id = nextId(PREFIX.REQUEST);
assert(/^REQ-\d{4}\d{3}$/.test(id), `nextId(REQUEST) format ok: ${id}`);

const now = new Date().toISOString();
recyclerRequests.push({
  _id: id, recyclerId: recycler._id, category: 'Old Laptops', quantity: 50, unit: 'pieces',
  note: 'verify test', targetDate: null, status: 'pending', allocatedInventory: [],
  reviewedBy: null, reviewNote: null, createdAt: now, updatedAt: now,
});
await flushAll();

const row = (await pool.query('select * from recycler_requests where id=$1', [id])).rows[0];
assert(!!row, 'request persisted to Postgres');
assert(row && row.category === 'Old Laptops' && Number(row.quantity) === 50, 'fields stored correctly');
assert(row && Array.isArray(row.allocated_inventory), 'allocated_inventory is a jsonb array');

// maskCode
assert(maskCode('USR-2606003', 'HUB') === 'HUB-606003', `maskCode hub: ${maskCode('USR-2606003', 'HUB')}`);
assert(maskCode('1776500179744-xwmpv7yo8', 'REC').startsWith('REC-'), `maskCode recycler: ${maskCode('1776500179744-xwmpv7yo8', 'REC')}`);

// cleanup
const idx = recyclerRequests.findIndex((r) => r._id === id);
recyclerRequests.splice(idx, 1);
await flushAll();
const after = (await pool.query('select count(*)::int c from recycler_requests where id=$1', [id])).rows[0].c;
assert(after === 0, 'test request cleaned up');

await pool.end();
console.log(ok ? '\n✅ backend store + helpers verified' : '\n❌ FAILED');
process.exit(ok ? 0 : 1);
