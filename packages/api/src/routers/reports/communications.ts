import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../../trpc";
import {
  getDb,
  morpheuMessages,
  eq,
  and,
  sql,
} from "@matrix-food/database";

const dateRangeInput = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const communicationsReportsRouter = createTRPCRouter({
  /** Estatísticas WhatsApp: enviadas/recebidas, por status, por tipo. */
  whatsappStats: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const periodFilter = and(
        eq(morpheuMessages.tenantId, ctx.tenantId),
        sql`${morpheuMessages.createdAt} >= ${input.from}`,
        sql`${morpheuMessages.createdAt} < ${input.to}`
      );

      const byDirection = await db
        .select({
          direction: morpheuMessages.direction,
          count: sql<number>`count(*)::int`,
        })
        .from(morpheuMessages)
        .where(periodFilter)
        .groupBy(morpheuMessages.direction);

      const byStatus = await db
        .select({
          status: morpheuMessages.status,
          count: sql<number>`count(*)::int`,
        })
        .from(morpheuMessages)
        .where(periodFilter)
        .groupBy(morpheuMessages.status);

      const byType = await db
        .select({
          type: morpheuMessages.messageType,
          count: sql<number>`count(*)::int`,
        })
        .from(morpheuMessages)
        .where(periodFilter)
        .groupBy(morpheuMessages.messageType);

      const dirMap = new Map(byDirection.map((r) => [r.direction, r.count]));
      const statusMap = new Map(byStatus.map((r) => [r.status, r.count]));
      const typeMap = new Map(byType.map((r) => [r.type, r.count]));

      const inbound = dirMap.get("INBOUND") ?? 0;
      const outbound = dirMap.get("OUTBOUND") ?? 0;
      const total = inbound + outbound;
      const delivered = statusMap.get("DELIVERED") ?? 0;
      const read = statusMap.get("READ") ?? 0;
      const failed = statusMap.get("FAILED") ?? 0;

      return {
        total,
        inbound,
        outbound,
        delivered,
        read,
        failed,
        deliveryRate: outbound > 0 ? (delivered / outbound) * 100 : 0,
        readRate: outbound > 0 ? (read / outbound) * 100 : 0,
        failureRate: outbound > 0 ? (failed / outbound) * 100 : 0,
        byType: Array.from(typeMap.entries()).map(([type, count]) => ({
          type,
          count,
        })),
      };
    }),

  /** Conversões: telefones que receberam mensagem e fizeram pedido depois. */
  morpheuConversions: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      // Quantos telefones únicos foram contactados (OUTBOUND)
      const [contacted] = await db
        .select({
          count: sql<number>`count(DISTINCT ${morpheuMessages.phoneE164})::int`,
        })
        .from(morpheuMessages)
        .where(
          and(
            eq(morpheuMessages.tenantId, ctx.tenantId),
            eq(morpheuMessages.direction, "OUTBOUND"),
            sql`${morpheuMessages.createdAt} >= ${input.from}`,
            sql`${morpheuMessages.createdAt} < ${input.to}`,
            sql`${morpheuMessages.phoneE164} IS NOT NULL`
          )
        );

      // Telefones que pediram após receber mensagem (heurística simples).
      // Compara phone (E164 sem +55) com customerPhone do pedido.
      const conversions = await db.execute<{ converted: number }>(sql`
        SELECT COUNT(DISTINCT o.customer_phone)::int AS converted
        FROM orders o
        WHERE o.tenant_id = ${ctx.tenantId}
          AND o.created_at >= ${input.from}
          AND o.created_at < ${input.to}
          AND o.status <> 'CANCELLED'
          AND EXISTS (
            SELECT 1
            FROM morpheu_messages m
            WHERE m.tenant_id = ${ctx.tenantId}
              AND m.direction = 'OUTBOUND'
              AND m.created_at >= ${input.from}
              AND m.created_at < o.created_at
              AND REGEXP_REPLACE(COALESCE(m.phone_e164, ''), '[^0-9]', '', 'g')
                  LIKE '%' || REGEXP_REPLACE(COALESCE(o.customer_phone, ''), '[^0-9]', '', 'g')
          )
      `);

      const list = (conversions as unknown as { rows?: Array<{ converted: number }> }).rows
        ?? (conversions as unknown as Array<{ converted: number }>);
      const converted = list?.[0]?.converted ?? 0;
      const contactedCount = contacted?.count ?? 0;

      return {
        contacted: contactedCount,
        converted,
        conversionRate: contactedCount > 0 ? (converted / contactedCount) * 100 : 0,
      };
    }),
});
