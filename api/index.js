// Vercel serverless entry for the whole Express API.
// All `/api/*` requests are routed here by the rewrite in vercel.json.
//
// `createServer()` runs schema migrations and hydrates state from Postgres, so
// cache the resolved app across warm invocations (init once per cold start, not
// once per request). An Express app is itself a valid (req, res) handler, so we
// just hand the request off to it.
//
// The server module is imported dynamically *inside* the try/catch so that a
// module-load failure (e.g. a missing native binding) returns a readable JSON
// error instead of Vercel's opaque FUNCTION_INVOCATION_FAILED.
let appPromise;

export default async function handler(req, res) {
  try {
    if (!appPromise) {
      const { createServer } = await import("../server/index.js");
      appPromise = createServer();
    }
    const app = await appPromise;

    // Express mounts every route under /api/*. Depending on how Vercel resolves
    // the rewrite, req.url may arrive without that prefix — normalize so Express
    // always matches (no-op when the prefix is already present).
    if (!/^\/api(\/|$|\?)/.test(req.url)) {
      req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
    }

    return app(req, res);
  } catch (err) {
    // Don't cache a rejected init promise — reset so the next request retries
    // (e.g. after env vars like DATABASE_URL are added in the dashboard).
    appPromise = undefined;
    console.error("API handler error:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: "Server initialization failed",
        detail: String((err && err.message) || err),
      }),
    );
  }
}
