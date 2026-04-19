import { timingSafeEqual } from "node:crypto";

/**
 * Compara `Authorization: Bearer <token>` do request contra o segredo esperado
 * de forma resistente a timing attacks. Retorna `true` se bater exatamente.
 */
export function isAuthorizedBearer(
  authorizationHeader: string | null | undefined,
  expectedSecret: string | undefined | null
): boolean {
  if (!authorizationHeader || !expectedSecret) return false;
  const prefix = "Bearer ";
  if (!authorizationHeader.startsWith(prefix)) return false;
  const received = authorizationHeader.slice(prefix.length);
  try {
    const a = Buffer.from(received);
    const b = Buffer.from(expectedSecret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
