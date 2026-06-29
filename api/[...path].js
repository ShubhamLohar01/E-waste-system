import { createServer } from "../server/index.js";

// Vercel serverless entry for the whole Express API.
// `createServer()` runs schema migrations and hydrates state from Postgres, so
// cache the promise and reuse the app across warm invocations (run init once
// per cold start, not once per request). An Express app is itself a valid
// (req, res) handler, so we just hand the request off to it.
let appPromise;

export default async function handler(req, res) {
  if (!appPromise) {
    appPromise = createServer();
  }
  const app = await appPromise;
  return app(req, res);
}
