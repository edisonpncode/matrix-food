/**
 * Backfill: aplica prazo de validade de 90 dias (a partir de hoje) em todos
 * os EARNED legados que ainda não têm `expires_at`.
 *
 * Rodar uma única vez após deploy do schema com o novo campo `expires_at`.
 * Idempotente — só atualiza linhas que estão com NULL.
 *
 * A escolha de "NOW() + 90d" (em vez de "created_at + 90d") é deliberada
 * para não expirar imediatamente pontos antigos do cliente — dá pelo menos
 * 90 dias a partir do deploy pra ele usar.
 *
 * Uso: pnpm db:backfill-loyalty-expiration
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

async function backfill() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Erro: DATABASE_URL nao esta definido no ambiente.");
    console.error(
      "Adicione ao seu .env ou rode: DATABASE_URL=... pnpm db:backfill-loyalty-expiration"
    );
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  let host = "(host nao identificado)";
  try {
    host = new URL(connectionString).host;
  } catch {}
  console.log(`Conectando em: ${host}`);
  console.log("Iniciando backfill de validade de pontos (90d a partir de hoje)...");

  const result = await db.execute<{ updated: number }>(sql`
    WITH updated AS (
      UPDATE loyalty_transactions
      SET expires_at = NOW() + INTERVAL '90 days'
      WHERE type = 'EARNED' AND expires_at IS NULL
      RETURNING id
    )
    SELECT COUNT(*)::int AS updated FROM updated
  `);

  const row = result[0];
  if (row) {
    console.log("");
    console.log("Backfill concluido:");
    console.log(`  Transacoes EARNED atualizadas: ${row.updated}`);
    console.log(`  Validade aplicada: NOW() + 90 dias`);
  }

  await client.end();
  process.exit(0);
}

backfill().catch((err) => {
  console.error("Erro durante backfill:", err);
  process.exit(1);
});
