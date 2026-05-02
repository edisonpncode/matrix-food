/**
 * Cron: expiração de pontos de fidelidade.
 *
 * Roda 1x/dia (configurado externamente via cron-job.org / Railway).
 *
 * Para cada par (tenantId, customerPhone) que tenha lote EARNED com
 * `expiresAt <= NOW()` e ainda não expirado, calcula via FIFO virtual
 * quantos pontos devem expirar agora, grava transação `EXPIRED` e debita
 * `customerTenants.loyaltyPointsBalance`.
 *
 * Idempotente: rodar duas vezes no mesmo dia não duplica expirações
 * (a transação EXPIRED da primeira rodada zera o batch na fila FIFO).
 *
 * Autenticação: header `Authorization: Bearer <LOYALTY_CRON_SECRET>`.
 */
import { NextResponse } from "next/server";
import {
  getDb,
  loyaltyTransactions,
  customerTenants,
  customers,
  eq,
  and,
  sql,
} from "@matrix-food/database";
import { calculateExpiration } from "@matrix-food/api/services/loyalty";
import { isAuthorizedBearer } from "@/lib/bearer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.LOYALTY_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "LOYALTY_CRON_SECRET não configurada" },
      { status: 500 }
    );
  }
  if (!isAuthorizedBearer(req.headers.get("authorization"), secret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const db = getDb();
  const now = new Date();

  // 1) Encontrar pares (tenantId, customerPhone) com EARNED já vencido.
  // Não filtra "EXPIRED já criado" porque o algoritmo FIFO trata isso —
  // se já foi expirado, totalToExpire vai dar 0 e não duplica.
  const candidates = await db
    .selectDistinct({
      tenantId: loyaltyTransactions.tenantId,
      customerPhone: loyaltyTransactions.customerPhone,
    })
    .from(loyaltyTransactions)
    .where(
      and(
        eq(loyaltyTransactions.type, "EARNED"),
        sql`${loyaltyTransactions.expiresAt} IS NOT NULL`,
        sql`${loyaltyTransactions.expiresAt} <= NOW()`
      )
    );

  let totalExpiredPoints = 0;
  let processed = 0;

  for (const { tenantId, customerPhone } of candidates) {
    // 2) Carrega histórico completo do par (cap em 500 pra defender contra
    // clientes patológicos — improvável passar disso por tenant).
    const txs = await db
      .select({
        type: loyaltyTransactions.type,
        points: loyaltyTransactions.points,
        expiresAt: loyaltyTransactions.expiresAt,
        createdAt: loyaltyTransactions.createdAt,
      })
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.tenantId, tenantId),
          eq(loyaltyTransactions.customerPhone, customerPhone)
        )
      )
      .limit(500);

    // 3) Roda FIFO virtual.
    const { totalToExpire } = calculateExpiration(txs, now);

    if (totalToExpire <= 0) continue;

    // 4) Grava transação EXPIRED.
    await db.insert(loyaltyTransactions).values({
      tenantId,
      customerPhone,
      type: "EXPIRED",
      points: -totalToExpire,
      description: "Pontos expirados",
      orderId: null,
      expiresAt: null,
    });

    // 5) Debita do saldo materializado se o cliente tiver vínculo registrado.
    const [link] = await db
      .select({ customerId: customerTenants.customerId })
      .from(customerTenants)
      .innerJoin(customers, eq(customers.id, customerTenants.customerId))
      .where(
        and(
          eq(customers.phone, customerPhone),
          eq(customerTenants.tenantId, tenantId)
        )
      )
      .limit(1);

    if (link) {
      await db
        .update(customerTenants)
        .set({
          loyaltyPointsBalance: sql`GREATEST(0, ${customerTenants.loyaltyPointsBalance} - ${totalToExpire})`,
        })
        .where(
          and(
            eq(customerTenants.customerId, link.customerId),
            eq(customerTenants.tenantId, tenantId)
          )
        );
    }

    totalExpiredPoints += totalToExpire;
    processed += 1;
  }

  return NextResponse.json({
    ok: true,
    processed,
    totalExpiredPoints,
    candidatesScanned: candidates.length,
    runAt: now.toISOString(),
  });
}
