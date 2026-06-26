import crypto from 'crypto';

function qrSecret() {
  return process.env.JWT_SECRET || 'dev-qr-secret-change-me';
}

const pad = (n, w) => String(n).padStart(w, '0');

/** Format a Date as TR-YYYYMMDDHHMMSS using local time components. */
export function formatTransactionNo(date = new Date()) {
  return (
    'TR-' +
    date.getFullYear() +
    pad(date.getMonth() + 1, 2) +
    pad(date.getDate(), 2) +
    pad(date.getHours(), 2) +
    pad(date.getMinutes(), 2) +
    pad(date.getSeconds(), 2)
  );
}

/**
 * Unique transaction number; appends -2, -3… on a same-second collision.
 * Uses local time — the caller must pass all existing transaction numbers so
 * uniqueness holds even across a DST fallback (same local second occurring twice).
 */
export function generateTransactionNo(existing = [], date = new Date()) {
  const base = formatTransactionNo(date);
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** BI-<prefix><4-digit seq>, e.g. makeBoxId('ABC', 1) -> 'BI-ABC0001'. */
export function makeBoxId(prefix, seq) {
  return `BI-${prefix}${pad(seq, 4)}`;
}

/** 3 random uppercase letters whose BI-XXX0001 is not already used. */
export function generateBoxPrefix(existingBoxIds = [], rng = Math.random) {
  const taken = new Set(existingBoxIds);
  const letter = () => String.fromCharCode(65 + Math.floor(rng() * 26));
  for (let attempt = 0; attempt < 1000; attempt++) {
    const prefix = letter() + letter() + letter();
    // Each transaction numbers its boxes from 0001, so a free BI-<prefix>0001 guarantees the whole prefix is free.
    if (!taken.has(makeBoxId(prefix, 1))) return prefix;
  }
  throw new Error('Could not allocate a free box prefix');
}

/** Signed QR payload encoding the transaction + box id. */
export function boxQrPayload(transactionNo, boxId) {
  const body = `BOX.${transactionNo}.${boxId}`;
  const sig = crypto.createHmac('sha256', qrSecret()).update(body).digest('hex').slice(0, 12);
  return `${body}.${sig}`;
}

/** { transactionNo, boxId } when the signature is valid, else null. */
export function verifyBoxQr(payload) {
  if (typeof payload !== 'string') return null;
  // Payload format: BOX.<transactionNo>.<boxId>.<sig12>
  // Neither transactionNo (TR-... or TR-...-N) nor boxId (BI-...) ever contains a '.', so split gives exactly 4 parts.
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== 'BOX') return null;
  const [, transactionNo, boxId, sig] = parts;
  const expect = crypto
    .createHmac('sha256', qrSecret())
    .update(`BOX.${transactionNo}.${boxId}`)
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
  return valid ? { transactionNo, boxId } : null;
}

/** Split a total weight into `count` per-box weights summing to the total (2dp). */
export function splitNetWeight(totalKg, count) {
  const n = Math.max(1, Math.floor(count) || 1);
  if (totalKg == null || totalKg === '' || isNaN(Number(totalKg))) {
    return Array.from({ length: n }, () => null);
  }
  const total = Number(totalKg);
  const per = Math.floor((total / n) * 100) / 100;
  const weights = Array.from({ length: n }, () => per);
  weights[n - 1] = Math.round((total - per * (n - 1)) * 100) / 100;
  return weights;
}
