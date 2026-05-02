import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../../trpc";
import {
  getDb,
  customerTenants,
  customers,
  orders,
  eq,
  and,
  desc,
  sql,
} from "@matrix-food/database";

const dateRangeInput = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const customersReportsRouter = createTRPCRouter({
  /** KPIs gerais: total clientes, ativos no período, ticket médio por cliente, % recorrentes. */
  customerOverview: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const [totals] = await db
        .select({
          total: sql<number>`count(*)::int`,
          totalSpent: sql<number>`COALESCE(SUM(${customerTenants.totalSpent}::numeric), 0)::numeric`,
          totalOrders: sql<number>`COALESCE(SUM(${customerTenants.totalOrders}), 0)::int`,
        })
        .from(customerTenants)
        .where(eq(customerTenants.tenantId, ctx.tenantId));

      const [activeInPeriod] = await db
        .select({
          customers: sql<number>`count(DISTINCT ${orders.customerId})::int`,
          revenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
          orderCount: sql<number>`count(*)::int`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.customerId} IS NOT NULL`,
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`,
            sql`${orders.status} <> 'CANCELLED'`
          )
        );

      const [returningQuery] = await db
        .select({
          returning: sql<number>`count(DISTINCT ${orders.customerId})::int`,
        })
        .from(orders)
        .innerJoin(
          customerTenants,
          and(
            eq(customerTenants.customerId, orders.customerId),
            eq(customerTenants.tenantId, orders.tenantId)
          )
        )
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.customerId} IS NOT NULL`,
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`,
            sql`${customerTenants.firstOrderAt} < ${input.from}`
          )
        );

      const total = totals?.total ?? 0;
      const active = activeInPeriod?.customers ?? 0;
      const returning = returningQuery?.returning ?? 0;
      const newCount = Math.max(active - returning, 0);
      const revenue = Number(activeInPeriod?.revenue ?? 0);
      const orderCount = activeInPeriod?.orderCount ?? 0;

      return {
        totalCustomers: total,
        activeInPeriod: active,
        newInPeriod: newCount,
        returningInPeriod: returning,
        returningRate: active > 0 ? (returning / active) * 100 : 0,
        revenueInPeriod: revenue,
        avgRevenuePerCustomer: active > 0 ? revenue / active : 0,
        avgOrdersPerCustomer:
          active > 0 ? orderCount / active : 0,
        avgTicketLifetime:
          (totals?.totalOrders ?? 0) > 0
            ? Number(totals?.totalSpent ?? 0) / (totals?.totalOrders ?? 1)
            : 0,
      };
    }),

  /** Top clientes por gasto total no período. */
  topCustomers: tenantProcedure
    .input(
      dateRangeInput.extend({
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db
        .select({
          customerId: orders.customerId,
          customerName: orders.customerName,
          customerPhone: orders.customerPhone,
          orderCount: sql<number>`count(*)::int`,
          totalSpent: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)::numeric`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`,
            sql`${orders.status} <> 'CANCELLED'`
          )
        )
        .groupBy(orders.customerId, orders.customerName, orders.customerPhone)
        .orderBy(desc(sql`SUM(${orders.total}::numeric)`))
        .limit(input.limit);

      return rows.map((r) => ({
        customerId: r.customerId,
        name: r.customerName,
        phone: r.customerPhone,
        orderCount: r.orderCount,
        totalSpent: Number(r.totalSpent),
        avgTicket:
          r.orderCount > 0 ? Number(r.totalSpent) / r.orderCount : 0,
      }));
    }),

  /** Novos vs recorrentes ao longo do tempo (granularity dia). */
  newVsReturning: tenantProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const rows = await db
        .select({
          bucket: sql<string>`DATE_TRUNC('day', ${orders.createdAt})::text`,
          customerId: orders.customerId,
          firstOrderAt: customerTenants.firstOrderAt,
        })
        .from(orders)
        .innerJoin(
          customerTenants,
          and(
            eq(customerTenants.customerId, orders.customerId),
            eq(customerTenants.tenantId, orders.tenantId)
          )
        )
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            sql`${orders.customerId} IS NOT NULL`,
            sql`${orders.createdAt} >= ${input.from}`,
            sql`${orders.createdAt} < ${input.to}`,
            sql`${orders.status} <> 'CANCELLED'`
          )
        );

      const byBucket = new Map<
        string,
        { newSet: Set<string>; returningSet: Set<string> }
      >();
      const fromDate = new Date(input.from);
      for (const r of rows) {
        if (!r.customerId) continue;
        const bucket = r.bucket;
        let entry = byBucket.get(bucket);
        if (!entry) {
          entry = { newSet: new Set(), returningSet: new Set() };
          byBucket.set(bucket, entry);
        }
        const isNew =
          r.firstOrderAt && new Date(r.firstOrderAt).getTime() >= fromDate.getTime();
        if (isNew) entry.newSet.add(r.customerId);
        else entry.returningSet.add(r.customerId);
      }

      const buckets = Array.from(byBucket.entries())
        .map(([bucket, { newSet, returningSet }]) => ({
          bucket,
          new: newSet.size,
          returning: returningSet.size,
        }))
        .sort((a, b) => a.bucket.localeCompare(b.bucket));

      return buckets;
    }),

  /** Matriz RFM. Avalia recência, frequência e gasto de cada cliente. */
  rfmMatrix: tenantProcedure
    .input(z.object({ asOf: z.string().datetime().optional() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const asOf = input.asOf ? new Date(input.asOf) : new Date();

      const rows = await db
        .select({
          customerId: customerTenants.customerId,
          name: customers.name,
          phone: customers.phone,
          totalOrders: customerTenants.totalOrders,
          totalSpent: customerTenants.totalSpent,
          lastOrderAt: customerTenants.lastOrderAt,
          firstOrderAt: customerTenants.firstOrderAt,
        })
        .from(customerTenants)
        .innerJoin(customers, eq(customerTenants.customerId, customers.id))
        .where(
          and(
            eq(customerTenants.tenantId, ctx.tenantId),
            sql`${customerTenants.totalOrders} > 0`
          )
        );

      if (rows.length === 0) {
        return { customers: [], summary: {} as Record<string, number> };
      }

      const enriched = rows.map((r) => {
        const days = r.lastOrderAt
          ? Math.floor((asOf.getTime() - new Date(r.lastOrderAt).getTime()) / 86400000)
          : 9999;
        return {
          customerId: r.customerId,
          name: r.name,
          phone: r.phone,
          orders: r.totalOrders,
          spent: Number(r.totalSpent),
          recencyDays: days,
        };
      });

      const recencyValues = enriched.map((c) => c.recencyDays);
      const frequencyValues = enriched.map((c) => c.orders);
      const monetaryValues = enriched.map((c) => c.spent);

      function score(values: number[], target: number, ascending: boolean): number {
        const sorted = [...values].sort((a, b) => a - b);
        const idx = sorted.findIndex((v) => v >= target);
        const pct = idx === -1 ? 1 : idx / sorted.length;
        const baseScore = Math.min(5, Math.max(1, Math.ceil(pct * 5)));
        return ascending ? baseScore : 6 - baseScore;
      }

      const classified = enriched.map((c) => {
        const r = score(recencyValues, c.recencyDays, false);
        const f = score(frequencyValues, c.orders, true);
        const m = score(monetaryValues, c.spent, true);
        const segment = classifySegment(r, f, m);
        return { ...c, r, f, m, segment };
      });

      const summary: Record<string, number> = {};
      for (const c of classified) {
        summary[c.segment] = (summary[c.segment] ?? 0) + 1;
      }

      return {
        customers: classified.sort((a, b) => b.spent - a.spent).slice(0, 200),
        summary,
      };
    }),

  /** Clientes inativos há mais de N dias. */
  churnAnalysis: tenantProcedure
    .input(
      z.object({
        daysSinceLastOrder: z.number().int().min(7).max(365).default(60),
        asOf: z.string().datetime().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const asOf = input.asOf ? new Date(input.asOf) : new Date();
      const threshold = new Date(asOf.getTime() - input.daysSinceLastOrder * 86400000);

      const rows = await db
        .select({
          customerId: customerTenants.customerId,
          name: customers.name,
          phone: customers.phone,
          totalOrders: customerTenants.totalOrders,
          totalSpent: customerTenants.totalSpent,
          lastOrderAt: customerTenants.lastOrderAt,
        })
        .from(customerTenants)
        .innerJoin(customers, eq(customerTenants.customerId, customers.id))
        .where(
          and(
            eq(customerTenants.tenantId, ctx.tenantId),
            sql`${customerTenants.totalOrders} > 0`,
            sql`${customerTenants.lastOrderAt} < ${threshold.toISOString()}`
          )
        )
        .orderBy(desc(customerTenants.totalSpent))
        .limit(200);

      return rows.map((r) => ({
        customerId: r.customerId,
        name: r.name,
        phone: r.phone,
        totalOrders: r.totalOrders,
        totalSpent: Number(r.totalSpent),
        lastOrderAt: r.lastOrderAt,
        daysInactive: r.lastOrderAt
          ? Math.floor((asOf.getTime() - new Date(r.lastOrderAt).getTime()) / 86400000)
          : null,
      }));
    }),
});

/** Classificação RFM em segmentos legíveis. */
function classifySegment(r: number, f: number, m: number): string {
  if (r >= 4 && f >= 4 && m >= 4) return "Champions";
  if (r >= 3 && f >= 3 && m >= 4) return "Leais";
  if (r >= 4 && f <= 2) return "Novos clientes";
  if (r === 5 && f === 1) return "Promissores";
  if (r <= 2 && f >= 4 && m >= 4) return "Em risco";
  if (r === 1 && f >= 4) return "Não posso perder";
  if (r <= 2 && f <= 2 && m <= 2) return "Hibernando";
  if (r === 1 && f <= 2) return "Perdidos";
  return "Atenção";
}
