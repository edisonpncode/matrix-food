/**
 * Backfill: popula customer_tenants.loyalty_points_balance a partir do
 * histórico de loyalty_transactions.
 *
 * Rodar uma única vez antes de usar a Fase 1 em produção.
 * Idempotente — pode rodar de novo sem duplicar saldos.
 *
 * Uso: pnpm db:backfill-loyalty
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

async function backfill() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Erro: DATABASE_URL nao esta definido no ambiente.");
    console.error("Adicione ao seu .env ou rode: DATABASE_URL=... pnpm db:backfill-loyalty");
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  // Mostra apenas o host (sem credenciais) pra confirmar em qual banco vai rodar
  let host = "(host nao identificado)";
  try {
    host = new URL(connectionString).host;
  } catch {}
  console.log(`Conectando em: ${host}`);
  console.log("Iniciando backfill de saldo de fidelidade...");

  await db.execute(sql`
    WITH balances AS (
      SELECT
        c.id AS customer_id,
        lt.tenant_id,
        SUM(lt.points)::int AS total_points
      FROM loyalty_transactions lt
      JOIN customers c ON c.phone = lt.customer_phone
      GROUP BY c.id, lt.tenant_id
    )
    UPDATE customer_tenants ct
    SET loyalty_points_balance = COALESCE(b.total_points, 0)
    FROM balances b
    WHERE ct.customer_id = b.customer_id
      AND ct.tenant_id = b.tenant_id
  `);

  const summary = await db.execute<{
    clientes_com_saldo: number;
    total_customer_tenants: number;
    pontos_totais_em_circulacao: number;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE loyalty_points_balance > 0)::int AS clientes_com_saldo,
      COUNT(*)::int AS total_customer_tenants,
      COALESCE(SUM(loyalty_points_balance), 0)::int AS pontos_totais_em_circulacao
    FROM customer_tenants
  `);

  const row = summary[0];
  if (row) {
    console.log("");
    console.log("Backfill concluido:");
    console.log(`  Clientes com saldo > 0: ${row.clientes_com_saldo}`);
    console.log(`  Total de relacoes cliente-restaurante: ${row.total_customer_tenants}`);
    console.log(`  Pontos totais em circulacao: ${row.pontos_totais_em_circulacao}`);
  }

  await client.end();
  process.exit(0);
}

backfill().catch((err) => {
  console.error("Erro durante backfill:", err);
  process.exit(1);
});
