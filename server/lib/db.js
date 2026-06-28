import 'dotenv/config';
import pg from 'pg';

// Return Postgres numeric/decimal (OID 1700) as JS numbers, not strings,
// so the app keeps seeing amounts/quantities as numbers like the old JSON store.
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

if (!process.env.DATABASE_URL) {
  console.error('[db] DATABASE_URL is not set — check your .env');
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL
  max: 5,
  keepAlive: true, // keep TCP alive so idle connections drop less often
  idleTimeoutMillis: 10_000, // close our idle clients before the Supabase pooler does
  connectionTimeoutMillis: 15_000,
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
