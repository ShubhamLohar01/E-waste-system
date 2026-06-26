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

/** Unique transaction number; appends -2, -3… on a same-second collision. */
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
    if (!taken.has(makeBoxId(prefix, 1))) return prefix;
  }
  throw new Error('Could not allocate a free box prefix');
}
