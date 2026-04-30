/**
 * Allowlist de emails autorizados a acessar /admin (painel master).
 * Lê SUPERADMIN_EMAILS (CSV) e normaliza para minúsculas.
 *
 * Sempre retorna a lista (possivelmente vazia). O fail-closed em produção
 * é responsabilidade dos pontos de uso (middleware/layout/trpc) — esses
 * já tratam allowlist vazia como "ninguém entra" e redirecionam/recusam.
 *
 * Esse contrato é importante porque o helper é executado durante o build
 * do Next.js (pre-render do layout RSC), quando as envs de runtime do
 * Railway ainda não estão disponíveis. Lançar erro aqui quebraria o build.
 */
export function getSuperadminAllowlist(): string[] {
  const raw = process.env.SUPERADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
