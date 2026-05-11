/**
 * Tiny in-memory sliding-window rate limiter.
 * Works fine for a single-process dev server; swap for Redis if you scale out.
 *
 * Usage:
 *   router.post('/login', rateLimit({ windowMs: 15*60_000, max: 5 }), handler);
 *   router.post('/send-email-code', rateLimit({ windowMs: 60*60_000, max: 3, keyOn: 'email' }), handler);
 */

const buckets = new Map(); // key → Array<timestamp>

export function rateLimit({ windowMs = 15 * 60_000, max = 10, keyOn = 'ip' } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key =
      keyOn === 'email'
        ? `em:${(req.body?.email || '').toLowerCase() || req.ip}`
        : `ip:${req.ip}`;
    const arr = buckets.get(key) || [];
    const fresh = arr.filter((t) => now - t < windowMs);
    if (fresh.length >= max) {
      const retryMs = windowMs - (now - fresh[0]);
      res.setHeader('Retry-After', Math.ceil(retryMs / 1000));
      return res.status(429).json({
        error: 'Too many requests. Please try again shortly.',
        retryAfterSeconds: Math.ceil(retryMs / 1000),
      });
    }
    fresh.push(now);
    buckets.set(key, fresh);
    next();
  };
}
