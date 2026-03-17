import bcrypt from 'bcrypt';

/**
 * Hash a password
 */
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a unique ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a QR code value (unique per item)
 */
export function generateQRCode() {
  return `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

/**
 * Generate next collection ID in format PYYYYMMDD001.
 * Sequence resets per day. Pass existing collection IDs (e.g. from inventory) to avoid duplicates.
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
  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Calculate reward points based on item quantity and status
 */
export function calculateRewardPoints(quantity, unit) {
  // 1 point per kg, 5 points per item
  if (unit === 'kg') {
    return Math.floor(quantity);
  } else if (unit === 'pieces' || unit === 'items') {
    return quantity * 5;
  }
  return 10; // default
}

/**
 * Check if milestone is reached
 */
export function checkMilestoneReached(currentPoints, threshold) {
  return currentPoints >= threshold;
}
