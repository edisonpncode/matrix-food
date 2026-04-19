import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token de acesso ao pedido — HMAC-SHA256 sobre o orderId.
 * Usado como prova de posse quando o cliente visualiza a página pública
 * de confirmação do pedido (`/pedido/[id]?t=...`), evitando IDOR.
 *
 * Reaproveita o mesmo segredo usado em `customer-session.ts`.
 */

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

export function signOrderAccessToken(orderId: string): string {
  return createHmac("sha256", getSecret()).update(orderId).digest("base64url");
}

export function verifyOrderAccessToken(
  orderId: string,
  token: string | undefined | null
): boolean {
  if (!orderId || !token) return false;
  const expected = signOrderAccessToken(orderId);
  try {
    const a = Buffer.from(token, "base64url");
    const b = Buffer.from(expected, "base64url");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
