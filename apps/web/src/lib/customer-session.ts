import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sessão do cliente (consumidor do link de pedidos) — assinada com HMAC.
 * Desacoplada do auth do staff (next-firebase-auth-edge).
 */

export const CUSTOMER_COOKIE_NAME = "mf-customer-session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export interface CustomerSessionPayload {
  customerId: string;
  phone: string | null;
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

export function createCustomerSession(
  customerId: string,
  phone: string | null
): string {
  const payload: CustomerSessionPayload = {
    customerId,
    phone,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(data);
  return `${data}.${sig}`;
}

export function verifyCustomerSession(
  token: string | undefined
): CustomerSessionPayload | null {
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
    ) as CustomerSessionPayload;
    if (!payload.customerId) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const CUSTOMER_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

/**
 * Helper para parsear o cookie de sessão de uma string de cookies HTTP.
 */
export function parseCustomerSessionCookie(
  cookieHeader: string | null | undefined
): CustomerSessionPayload | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const c of cookies) {
    const [name, ...rest] = c.split("=");
    if (name === CUSTOMER_COOKIE_NAME) {
      return verifyCustomerSession(rest.join("="));
    }
  }
  return null;
}
