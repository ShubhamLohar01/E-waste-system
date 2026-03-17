/**
 * In-memory stores for OTP (phone) and email verification codes.
 * In production, use Redis or similar with TTL.
 */
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

const phoneOtpStore = new Map();
const emailCodeStore = new Map();

function normalizePhone(phone) {
  return phone.replace(/\D/g, '').trim() || phone;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function generateDigitCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

/** Store OTP for phone; returns the code (in production, send via SMS). */
export function setPhoneOtp(phone) {
  const key = normalizePhone(phone);
  const code = generateDigitCode(6);
  phoneOtpStore.set(key, {
    code,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
  });
  return code;
}

/** Verify phone OTP and consume it. */
export function verifyPhoneOtp(phone, code) {
  const key = normalizePhone(phone);
  const entry = phoneOtpStore.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    phoneOtpStore.delete(key);
    return false;
  }
  if (entry.code !== code) return false;
  phoneOtpStore.delete(key);
  return true;
}

/** Store code for email and optionally send via SMTP. */
export function setEmailCode(email) {
  const key = normalizeEmail(email);
  const code = generateDigitCode(6);
  emailCodeStore.set(key, {
    code,
    expiresAt: Date.now() + CODE_EXPIRY_MS,
  });
  return code;
}

/** Verify email code and consume it. */
export function verifyEmailCode(email, code) {
  const key = normalizeEmail(email);
  const entry = emailCodeStore.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    emailCodeStore.delete(key);
    return false;
  }
  if (entry.code !== code) return false;
  emailCodeStore.delete(key);
  return true;
}

/**
 * Send verification code to email. Uses nodemailer if installed and SMTP env vars are set;
 * otherwise logs the code to console (dev). Set SMTP_HOST, SMTP_USER, SMTP_PASS to send real email.
 */
export async function sendVerificationEmail(email, code) {
  const useSmtp =
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;

  if (useSmtp) {
    try {
      // Dynamic import so app works without nodemailer installed (dev: code logged to console)
      const nodemailer = await import('nodemailer').catch(() => null);
      if (!nodemailer?.default) {
        console.log(`[E-Waste Hub] Verification code for ${email}: ${code}`);
        return { sent: true };
      }
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Your E-Waste Hub verification code',
        text: `Your verification code is: ${code}. It expires in 10 minutes.`,
        html: `<p>Your verification code is: <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
      });
      return { sent: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send email';
      return { sent: false, error: message };
    }
  }

  // Dev fallback: log code to console (user can read server logs or use SMTP later)
  console.log(`[E-Waste Hub] Verification code for ${email}: ${code}`);
  return { sent: true };
}
