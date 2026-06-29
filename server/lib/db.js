import 'dotenv/config';
import pg from 'pg';

// Return Postgres numeric/decimal (OID 1700) as JS numbers, not strings,
// so the app keeps seeing amounts/quantities as numbers like the old JSON store.
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

if (!process.env.DATABASE_URL) {
  console.error('[db] DATABASE_URL is not set — check your .env');
}

// On Vercel each serverless instance gets its OWN pool, and frozen instances keep
// their connections open until the platform recycles them. With many concurrent
// instances that exhausts Supabase's pooler client limit (200), so cap each
// instance at a single connection and release it quickly when idle. Locally one
// long-lived process serves every request, so a small normal pool is fine.
const onServerless = !!process.env.VERCEL;
// Tunable without a code change: set PG_POOL_MAX in the Vercel env. Keep it at 1
// for classic serverless (1 request per instance); raise it (e.g. 3–5) if you
// enable Fluid Compute, where one instance serves many concurrent requests.
const poolMax = Number(process.env.PG_POOL_MAX) || (onServerless ? 1 : 5);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL
  max: poolMax,
  keepAlive: true, // keep TCP alive so idle connections drop less often
  idleTimeoutMillis: onServerless ? 2_000 : 10_000, // release idle clients fast on serverless
  connectionTimeoutMillis: onServerless ? 8_000 : 15_000, // fail clean before the function times out
  allowExitOnIdle: true, // don't pin idle connections open when the instance goes quiet
});

// Idle pooled clients can be terminated by the Supabase pooler. Handling this event
// stops those drops from crashing the process — the pool just opens a fresh client.
pool.on('error', (err) => console.error('[db] idle client error (ignored, pool recovers):', err.message));

// Safety net: the managed pooler occasionally resets connections. Swallow ONLY those
// transient connection errors so the dev/app server stays up; re-crash on real bugs.
const TRANSIENT = /Connection terminated|terminated unexpectedly|ECONNRESET|read ECONNRESET|socket hang up/i;
process.on('uncaughtException', (err) => {
  if (TRANSIENT.test(err?.message || '')) {
    console.error('[db] swallowed transient connection error:', err.message);
    return;
  }
  console.error('Uncaught exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason);
  if (TRANSIENT.test(msg)) {
    console.error('[db] swallowed transient connection rejection:', msg);
    return;
  }
  console.error('Unhandled rejection:', reason);
});
