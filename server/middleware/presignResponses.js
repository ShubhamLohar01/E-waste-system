import { isS3Configured, presignDeep } from '../services/s3.js';

/**
 * Wraps res.json so any S3 object URL anywhere in the response body is replaced
 * with a short-lived presigned URL the browser can load (bucket stays private).
 * One central place — every endpoint that returns photos/invoices/verificationPhotos
 * is covered automatically, current and future.
 */
export function presignResponses(req, res, next) {
  if (!isS3Configured()) return next();
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    presignDeep(body)
      .then((signed) => originalJson(signed))
      .catch((e) => {
        console.error('[presign] response signing failed:', e?.message || e);
        originalJson(body);
      });
    return res;
  };
  next();
}
