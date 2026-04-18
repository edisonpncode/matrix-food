import { describe, it, expect, vi, afterEach } from "vitest";
import {
  generateOtpCode,
  hashOtpCode,
  otpExpiresAt,
  isOtpExpired,
  canAttemptOtp,
  OTP_MAX_ATTEMPTS,
} from "../services/morpheu/otp";

describe("generateOtpCode", () => {
  it("retorna 6 dígitos numéricos", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashOtpCode", () => {
  it("é determinístico", () => {
    expect(hashOtpCode("123456", "salt")).toBe(hashOtpCode("123456", "salt"));
  });
  it("muda com salt diferente", () => {
    expect(hashOtpCode("123456", "a")).not.toBe(hashOtpCode("123456", "b"));
  });
  it("muda com código diferente", () => {
    expect(hashOtpCode("123456", "s")).not.toBe(hashOtpCode("654321", "s"));
  });
});

describe("otpExpiresAt / isOtpExpired", () => {
  afterEach(() => vi.useRealTimers());

  it("expira 10 min no futuro", () => {
    const now = Date.now();
    const exp = otpExpiresAt();
    // ~10 min, tolera até 1s de drift
    expect(exp.getTime() - now).toBeGreaterThan(10 * 60 * 1000 - 1000);
    expect(exp.getTime() - now).toBeLessThan(10 * 60 * 1000 + 1000);
  });

  it("não está expirado imediatamente", () => {
    expect(isOtpExpired(otpExpiresAt())).toBe(false);
  });

  it("considera expirado se for null", () => {
    expect(isOtpExpired(null)).toBe(true);
    expect(isOtpExpired(undefined)).toBe(true);
  });

  it("considera expirado se o tempo passou", () => {
    vi.useFakeTimers();
    const exp = otpExpiresAt();
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    expect(isOtpExpired(exp)).toBe(true);
  });
});

describe("canAttemptOtp", () => {
  it(`permite abaixo de ${OTP_MAX_ATTEMPTS}`, () => {
    expect(canAttemptOtp(0)).toBe(true);
    expect(canAttemptOtp(OTP_MAX_ATTEMPTS - 1)).toBe(true);
  });
  it("bloqueia no limite ou acima", () => {
    expect(canAttemptOtp(OTP_MAX_ATTEMPTS)).toBe(false);
    expect(canAttemptOtp(OTP_MAX_ATTEMPTS + 1)).toBe(false);
  });
});
