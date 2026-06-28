/**
 * S3 upload service. Stores photos / invoices in an S3 bucket and returns the
 * object URL (which we persist in Postgres instead of the base64 blob).
 *
 * Configured via env: AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION.
 * If any are missing, isS3Configured() returns false and callers fall back to base64.
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// .trim() guards against stray spaces in .env values.
const region = (process.env.AWS_REGION || 'ap-south-1').trim();
const bucket = (process.env.AWS_S3_BUCKET_NAME || '').trim();
const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();

let client = null;

export function isS3Configured() {
  return Boolean(bucket && accessKeyId && secretAccessKey);
}

function getClient() {
  if (!client) {
    client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  }
  return client;
}

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};

let counter = 0;

/**
 * Upload a base64 data URL (`data:<mime>;base64,<data>`) to S3.
 * Returns { url, key, type }. Throws on invalid data URL or S3 error.
 */
export async function uploadDataUrl(dataUrl, keyPrefix = 'uploads') {
  const m = /^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw new Error('Invalid data URL');
  const [, mime, b64] = m;
  const body = Buffer.from(b64, 'base64');
  const ext = EXT_BY_MIME[mime] || 'bin';
  const key = `${keyPrefix}/${Date.now()}-${(counter++).toString(36)}-${body.length}.${ext}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: mime,
    })
  );

  return { url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`, key, type: mime };
}

const BUCKET_URL_PREFIX = `https://${bucket}.s3.${region}.amazonaws.com/`;

/**
 * Turn a stored attachment URL into something a browser can load.
 * - If it's an S3 URL for our bucket, return a short-lived presigned GET URL
 *   (so the bucket can stay private).
 * - Anything else (base64 data URL, external URL) is returned unchanged.
 */
export async function presignUrl(stored, expiresIn = 3600) {
  if (!isS3Configured() || typeof stored !== 'string') return stored;
  // Only sign raw object URLs for our bucket. A '?' means it's already a
  // presigned URL (has query params) — leave it alone to avoid double-signing.
  if (!stored.startsWith(BUCKET_URL_PREFIX) || stored.includes('?')) return stored;
  const key = decodeURIComponent(stored.slice(BUCKET_URL_PREFIX.length));
  return getSignedUrl(getClient(), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}

/**
 * Recursively walk a JSON-serialisable value and presign any S3 object URL
 * found in a string (at any depth). Non-S3 strings pass through unchanged.
 */
export async function presignDeep(value) {
  if (typeof value === 'string') return presignUrl(value);
  if (Array.isArray(value)) return Promise.all(value.map((v) => presignDeep(v)));
  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value).map(async ([k, v]) => [k, await presignDeep(v)])
    );
    return Object.fromEntries(entries);
  }
  return value;
}

