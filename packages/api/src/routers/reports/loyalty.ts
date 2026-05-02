import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../../trpc";
import {
  getDb,
  loyaltyTransactions,
  customerTenants,
  customers,
  eq,
  and,
  desc,
  sql,
} from "@matrix-food/database";

const dateRangeInput = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const loyaltyReportsRouter = createTRPCRouter({
  /** Pontos emitidos vs gastos vs expirados no período. */
  loyaltyFlow: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db
        .select({
          type: loyaltyTransactions.type,
          points: sql<number>`COALESCE(SUM(${loyaltyTransactions.points}), 0)::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.tenantId, ctx.tenantId),
            sql`${loyaltyTransactions.createdAt} >= ${input.from}`,
            sql`${loyaltyTransactions.createdAt} < ${input.to}`
          )
        )
        .groupBy(loyaltyTransactions.type);

      const data: Record<
        string,
        { points: number; count: number }
      > = {};
      for (const r of rows) {
        data[r.type] = { points: Math.abs(r.points), count: r.count };
      }

      // Série temporal por dia
      const daily = await db
        .select({
          bucket: sql<string>`DATE_TRUNC('day', ${loyaltyTransactions.createdAt})::text`,
          type: loyaltyTransactions.type,
          points: sql<number>`COALESCE(SUM(ABS(${loyaltyTransactions.points})), 0)::int`,
        })
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.tenantId, ctx.tenantId),
            sql`${loyaltyTransactions.createdAt} >= ${input.from}`,
            sql`${loyaltyTransactions.createdAt} < ${input.to}`
          )
        )
        .groupBy(
          sql`DATE_TRUNC('day', ${loyaltyTransactions.createdAt})`,
          loyaltyTransactions.type
        );

      const map = new Map<
        string,
        { bucket: string; EARNED: number; REDEEMED: number; EXPIRED: number; ADJUSTMENT: number }
      >();
      for (const d of daily) {
        let entry = map.get(d.bucket);
        if (!entry) {
          entry = {
            bucket: d.bucket,
            EARNED: 0,
            REDEEMED: 0,
            EXPIRED: 0,
            ADJUSTMENT: 0,
          };
          map.set(d.bucket, entry);
        }
        entry[d.type as keyof typeof entry] = d.points;
      }
      const series = Array.from(map.values()).sort((a, b) =>
        a.bucket.localeCompare(b.bucket)
      );

      return {
        totals: {
          earned: data.EARNED?.points ?? 0,
          redeemed: data.REDEEMED?.points ?? 0,
          expired: data.EXPIRED?.points ?? 0,
          adjustment: data.ADJUSTMENT?.points ?? 0,
        },
        counts: {
          earned: data.EARNED?.count ?? 0,
          redeemed: data.REDEEMED?.count ?? 0,
          expired: data.EXPIRED?.count ?? 0,
        },
        series,
      };
    }),

  /** Top clientes que mais resgataram pontos. */
  topRedeemers: tenantProcedure
    .input(
      dateRangeInput.extend({
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db
        .select({
          customerPhone: loyaltyTransactions.customerPhone,
          pointsRedeemed: sql<number>`COALESCE(SUM(ABS(${loyaltyTransactions.points})), 0)::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.tenantId, ctx.tenantId),
            eq(loyaltyTransactions.type, "REDEEMED"),
            sql`${loyaltyTransactions.createdAt} >= ${input.from}`,
            sql`${loyaltyTransactions.createdAt} < ${input.to}`
          )
        )
        .groupBy(loyaltyTransactions.customerPhone)
        .orderBy(desc(sql`SUM(ABS(${loyaltyTransactions.points}))`))
        .limit(input.limit);

      // Enriquecer com nome do cliente onde possível
      const phones = rows.map((r) => r.customerPhone).filter(Boolean);
      const customerData = phones.length
        ? await db
            .select({
              phone: customers.phone,
              name: customers.name,
            })
            .from(customers)
            .where(sql`${customers.phone} = ANY(${phones})`)
        : [];
      const nameMap = new Map(customerData.map((c) => [c.phone, c.name]));

      return rows.map((r) => ({
        phone: r.customerPhone,
        name: nameMap.get(r.customerPhone) ?? null,
        pointsRedeemed: r.pointsRedeemed,
        redemptions: r.count,
      }));
    }),

  /** Saldo total em circulação (passivo do programa). */
  pointsLiability: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();

    const [row] = await db
      .select({
        totalPoints: sql<number>`COALESCE(SUM(${customerTenants.loyaltyPointsBalance}), 0)::int`,
        customersWithBalance: sql<number>`SUM(CASE WHEN ${customerTenants.loyaltyPointsBalance} > 0 THEN 1 ELSE 0 END)::int`,
      })
      .from(customerTenants)
      .where(eq(customerTenants.tenantId, ctx.tenantId));

    return {
      totalPoints: row?.totalPoints ?? 0,
      customersWithBalance: row?.customersWithBalance ?? 0,
    };
  }),
});
