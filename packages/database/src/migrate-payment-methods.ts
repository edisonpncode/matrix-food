/**
 * Migra `tenants.payment_methods_accepted` do formato antigo (string[])
 * para o novo formato (PaymentMethodConfig[]).
 *
 * Idempotente — detecta se já está no formato novo e pula.
 *
 * Uso: pnpm --filter @matrix-food/database tsx --env-file=../../.env.local src/migrate-payment-methods.ts
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { DEFAULT_PAYMENT_METHODS, type PaymentMethodConfig } from "@matrix-food/utils";
import * as schema from "./schema";

const DEFAULT_LABELS: Record<string, string> = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartão de Crédito",
  DEBIT_CARD: "Cartão de Débito",
};

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Erro: DATABASE_URL não está definido no ambiente.");
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  let host = "(host não identificado)";
  try {
    host = new URL(connectionString).host;
  } catch {}
  console.log(`Conectando em: ${host}`);

  const allTenants = await db.select().from(schema.tenants);
  console.log(`${allTenants.length} restaurante(s) encontrado(s).`);

  let migrated = 0;
  let skipped = 0;

  for (const tenant of allTenants) {
    const current = tenant.paymentMethodsAccepted as unknown;

    // Já está no formato novo (objetos com .code)
    if (
      Array.isArray(current) &&
      current.length > 0 &&
      typeof current[0] === "object" &&
      current[0] !== null &&
      "code" in current[0]
    ) {
      skipped++;
      continue;
    }

    // null/undefined → aplica defaults
    if (!Array.isArray(current) || current.length === 0) {
      await db
        .update(schema.tenants)
        .set({ paymentMethodsAccepted: DEFAULT_PAYMENT_METHODS })
        .where(eq(schema.tenants.id, tenant.id));
      migrated++;
      console.log(`  ✓ ${tenant.slug}: aplicado defaults`);
      continue;
    }

    // Formato antigo (string[]) → converte preservando ordem
    const legacy = current as string[];
    const next: PaymentMethodConfig[] = legacy
      .filter((code): code is "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD" =>
        ["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD"].includes(code)
      )
      .map((code, i) => ({
        id: code,
        code,
        label: DEFAULT_LABELS[code] ?? code,
        enabled: true,
        order: i,
        isCustom: false,
      }));

    await db
      .update(schema.tenants)
      .set({ paymentMethodsAccepted: next.length > 0 ? next : DEFAULT_PAYMENT_METHODS })
      .where(eq(schema.tenants.id, tenant.id));

    migrated++;
    console.log(`  ✓ ${tenant.slug}: ${legacy.join(",")} → ${next.length} forma(s)`);
  }

  console.log(`\nConcluído: ${migrated} migrado(s), ${skipped} já no formato novo.`);
  await client.end();
}

migrate().catch((err) => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
