import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Hash a password (bcrypt, cost 10)
 */
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * ---------- QR codes (HMAC-signed) ----------
 * Format:  INV.<inventoryIdish>.<timestamp>.<signature12>
 * Signature uses JWT_SECRET so forging requires leaking the secret.
 *
 * `inventoryIdish` is a short random token when the inventory id isn't known
 * yet (legacy callers using `generateQRCode()` with no args).
 */
function qrSecret() {
  return process.env.JWT_SECRET || 'dev-qr-secret-change-me';
}

export function generateQRCode(inventoryId = null) {
  const token = inventoryId || Math.random().toString(36).slice(2, 11).toUpperCase();
  const payload = `INV.${token}.${Date.now()}`;
  const sig = crypto.createHmac('sha256', qrSecret()).update(payload).digest('hex').slice(0, 12);
  return `${payload}.${sig}`;
}

/**
 * Per-unit QR codes — one signed code per physical unit of an item.
 * Deterministic (no timestamp) so they survive reloads and can be regenerated
 * from the item id + index without storing them. Format: INVU.<itemId>-U<n>.<sig>
 */
export function generateUnitQRCode(itemId, n) {
  const payload = `INVU.${itemId}-U${n}`;
  const sig = crypto.createHmac('sha256', qrSecret()).update(payload).digest('hex').slice(0, 12);
  return `${payload}.${sig}`;
}

/** Returns an array of `count` unit codes (1-based), capped at `max` to stay printable. */
export function generateUnitQRCodes(itemId, count, max = 100) {
  const n = Math.max(1, Math.min(Math.floor(Number(count) || 1), max));
  return Array.from({ length: n }, (_, i) => generateUnitQRCode(itemId, i + 1));
}

/** Returns { inventoryIdish, issuedAt } when the QR is valid, null otherwise. */
export function verifyQRCode(qr) {
  if (typeof qr !== 'string') return null;
  const parts = qr.split('.');
  if (parts.length !== 4 || parts[0] !== 'INV') return null;
  const [, token, ts, sig] = parts;
  const expect = crypto
    .createHmac('sha256', qrSecret())
    .update(`INV.${token}.${ts}`)
    .digest('hex')
    .slice(0, 12);
  let valid = false;
  try {
    valid =
      sig.length === expect.length &&
      crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expect, 'utf8'));
  } catch {
    valid = false;
  }
  if (!valid) return null;
  return { token, issuedAt: Number(ts) };
}

/**
 * ---------- Misc ----------
 */
export function generateCollectionId(existingCollectionIds) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `P${yyyy}${mm}${dd}`;
  const sameDay = existingCollectionIds.filter((id) => id.startsWith(prefix));
  let maxSeq = 0;
  for (const id of sameDay) {
    const seq = parseInt(id.slice(prefix.length), 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export function calculateRewardPoints(quantity, unit) {
  if (unit === 'kg') return Math.floor(quantity);
  if (unit === 'pieces' || unit === 'items') return quantity * 5;
  return 10;
}

/**
 * ---------- Image validation ----------
 * Reject data-URL images bigger than `maxBytes` and any non-image MIME type.
 * Returns { ok: true } or { ok: false, error: string }.
 */
export function validateImageDataUrl(dataUrl, maxBytes = 5 * 1024 * 1024) {
  if (!dataUrl || typeof dataUrl !== 'string') return { ok: false, error: 'Photo missing or invalid' };
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { ok: false, error: 'Photo must be a valid image data URL' };
  const [, mime, b64] = m;
  if (!/^image\//.test(mime)) return { ok: false, error: 'Photo must be an image' };
  // 4 base64 chars = 3 bytes
  const sizeBytes = Math.floor((b64.length * 3) / 4);
  if (sizeBytes > maxBytes) {
    return { ok: false, error: `Photo too large (${Math.round(sizeBytes / 1024)} KB). Max is ${Math.round(maxBytes / 1024)} KB.` };
  }
  return { ok: true, sizeBytes, mime };
}

/**
 * Validate an invoice attachment data URL — accepts PDF or image, base64.
 * (When S3 is wired up, invoice.dataUrl becomes an https URL and this check moves
 * to the upload step instead.)
 */
export function validateInvoiceDataUrl(dataUrl, maxBytes = 10 * 1024 * 1024) {
  if (!dataUrl || typeof dataUrl !== 'string') return { ok: false, error: 'Invoice missing or invalid' };
  const m = /^data:(application\/pdf|image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { ok: false, error: 'Invoice must be a PDF or image data URL' };
  const [, mime, b64] = m;
  const sizeBytes = Math.floor((b64.length * 3) / 4);
  if (sizeBytes > maxBytes) {
    return { ok: false, error: `Invoice too large (${Math.round(sizeBytes / 1024)} KB). Max is ${Math.round(maxBytes / 1024)} KB.` };
  }
  return { ok: true, sizeBytes, mime };
}

export function checkMilestoneReached(currentPoints, threshold) {
  return currentPoints >= threshold;
}

/**
 * Anonymised, stable display code for a user id — e.g. maskCode(id, 'HUB') → 'HUB-9F3A2C'.
 * Used so a recycler sees only a hub code (not its name/address) and vice-versa.
 */
export function maskCode(id, label) {
  if (!id) return null;
  const tail = String(id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  return `${label}-${tail}`;
}
