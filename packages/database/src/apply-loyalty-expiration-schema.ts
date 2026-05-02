/**
 * Aplica as 3 mudanças de schema da feature "validade de pontos de fidelidade":
 *
 *   1. loyalty_config.points_expiration_days (integer, nullable)
 *   2. loyalty_transactions.expires_at (timestamp, nullable)
 *   3. Índice parcial loyalty_tx_expiration_idx
 *
 * Usa IF NOT EXISTS — pode rodar mais de uma vez sem erro.
 * Roda apenas essas mudanças, sem aplicar pendências de outros commits.
 *
 * Uso: pnpm db:apply-loyalty-expiration
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

async function apply() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Erro: DATABASE_URL nao esta definido no ambiente.");
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  let host = "(host nao identificado)";
  try {
    host = new URL(connectionString).host;
  } catch {}
  console.log(`Conectando em: ${host}`);
  console.log("Aplicando mudancas do schema de validade de pontos...");

  await db.execute(sql`
    ALTER TABLE "loyalty_config"
    ADD COLUMN IF NOT EXISTS "points_expiration_days" integer
  `);
  console.log("  [OK] loyalty_config.points_expiration_days");

  await db.execute(sql`
    ALTER TABLE "loyalty_transactions"
    ADD COLUMN IF NOT EXISTS "expires_at" timestamp
  `);
  console.log("  [OK] loyalty_transactions.expires_at");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "loyalty_tx_expiration_idx"
    ON "loyalty_transactions" USING btree ("tenant_id","expires_at")
    WHERE "loyalty_transactions"."type" = 'EARNED'
      AND "loyalty_transactions"."expires_at" IS NOT NULL
  `);
  console.log("  [OK] loyalty_tx_expiration_idx");

  // Confirma que as colunas existem
  const cols = await db.execute<{ table_name: string; column_name: string }>(sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE (table_name = 'loyalty_config' AND column_name = 'points_expiration_days')
       OR (table_name = 'loyalty_transactions' AND column_name = 'expires_at')
    ORDER BY table_name, column_name
  `);

  console.log("");
  console.log("Verificacao:");
  for (const c of cols) {
    console.log(`  ${c.table_name}.${c.column_name} existe`);
  }

  if (cols.length !== 2) {
    console.error("");
    console.error(
      `Aviso: esperava 2 colunas, encontrou ${cols.length}. Verifique o banco manualmente.`
    );
    process.exit(2);
  }

  console.log("");
  console.log("Tudo certo! Voce ja pode salvar a configuracao de fidelidade.");

  await client.end();
  process.exit(0);
}

apply().catch((err) => {
  console.error("Erro ao aplicar mudancas:", err);
  process.exit(1);
});
