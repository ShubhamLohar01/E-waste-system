import { scheduleFlush, flushAll } from '../lib/pgStore.js';

// Re-exported for any caller that wants a synchronous full flush (e.g. scripts).
export { flushAll };

/**
 * After every mutating request, persist the in-memory arrays back to Postgres.
 * The flush is coalesced and runs after the response is sent.
 */
export function persistAll(req, res, next) {
  res.on('finish', () => {
    const m = req.method;
    if (m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE') {
      scheduleFlush();
    }
  });
  next();
}
