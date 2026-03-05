/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

/** Auth: send OTP to phone */
export interface SendOtpRequest {
  phone: string;
}
export interface SendOtpResponse {
  success: boolean;
  error?: string;
}

/** Auth: verify OTP and login or get register token */
export interface VerifyOtpRequest {
  phone: string;
  code: string;
}
export interface VerifyOtpResponse {
  token?: string;
  user?: { _id: string; name: string; email: string; role: string; trustLevel: string };
  needsRegister?: boolean;
  verifyToken?: string;
  error?: string;
}

/** Auth: send verification code to email (Gmail) */
export interface SendEmailCodeRequest {
  email: string;
}
export interface SendEmailCodeResponse {
  success: boolean;
  error?: string;
}

/** Auth: verify email code and login or get register token */
export interface VerifyEmailCodeRequest {
  email: string;
  code: string;
}
export interface VerifyEmailCodeResponse {
  token?: string;
  user?: { _id: string; name: string; email: string; role: string; trustLevel: string };
  needsRegister?: boolean;
  verifyToken?: string;
  error?: string;
}

/** Auth: register with phone after OTP verified */
export interface RegisterWithPhoneRequest {
  verifyToken: string;
  name: string;
  role: string;
  address?: string;
}

/** Auth: register with email after code verified */
export interface RegisterWithEmailRequest {
  verifyToken: string;
  name: string;
  role: string;
  address?: string;
}
