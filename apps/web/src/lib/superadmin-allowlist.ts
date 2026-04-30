/**
 * Allowlist de emails autorizados a acessar /admin (painel master).
 * Lê SUPERADMIN_EMAILS (CSV) e normaliza para minúsculas.
 *
 * Fail-closed em produção: se a env não estiver configurada, lançar erro
 * em vez de retornar lista vazia silenciosa — assim a aplicação morre
 * em vez de mascarar uma configuração errada.
 */
export function getSuperadminAllowlist(): string[] {
  const raw = process.env.SUPERADMIN_EMAILS ?? "";
  const list = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (list.length === 0 && process.env.NODE_ENV === "production") {
    throw new Error(
      "SUPERADMIN_EMAILS não está configurado. O painel /admin não pode operar sem allowlist."
    );
  }
  return list;
}
