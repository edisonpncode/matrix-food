import { createHash, randomInt } from "crypto";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 min
const MAX_ATTEMPTS = 5;

export function generateOtpCode(): string {
  // 6 dígitos com zero à esquerda garantido
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtpCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export function otpExpiresAt(): Date {
  return new Date(Date.now() + OTP_TTL_MS);
}

export function isOtpExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() < Date.now();
}

export function canAttemptOtp(attempts: number): boolean {
  return attempts < MAX_ATTEMPTS;
}

export const OTP_MAX_ATTEMPTS = MAX_ATTEMPTS;
