import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@matrix-food/auth";

/**
 * Sessão de funcionário (POS / painel restaurante) — assinada com HMAC.
 * Permite que o staff opere sem depender do cookie Firebase do dono.
 */

export const STAFF_COOKIE_NAME = "mf-staff-session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

export interface StaffSessionPayload {
  staffId: string;
  tenantId: string;
  role: UserRole;
  exp: number;
}

function getSecret(): string {
  const secret =
    process.env.AUTH_COOKIE_SECRET_CURRENT ??
    process.env.COOKIE_SECRET_CURRENT;
  if (!secret) {
    throw new Error(
      "AUTH_COOKIE_SECRET_CURRENT (ou COOKIE_SECRET_CURRENT) não definido."
    );
  }
  return secret;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function createStaffSession(payload: {
  staffId: string;
  tenantId: string;
  role: UserRole;
}): string {
  const full: StaffSessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const data = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = sign(data);
  return `${data}.${sig}`;
}

export function verifyStaffSession(
  token: string | undefined
): StaffSessionPayload | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf-8")
    ) as StaffSessionPayload;
    if (!payload.staffId || !payload.tenantId || !payload.role) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const STAFF_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

export function parseStaffSessionCookie(
  cookieHeader: string | null | undefined
): StaffSessionPayload | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const c of cookies) {
    const [name, ...rest] = c.split("=");
    if (name === STAFF_COOKIE_NAME) {
      return verifyStaffSession(rest.join("="));
    }
  }
  return null;
}
