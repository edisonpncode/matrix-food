import { tool } from "ai";
import { z } from "zod";
import {
  getDb,
  orders,
  orderItems,
  products,
  categories,
  cashRegisterSessions,
  customers,
  eq,
  and,
  gte,
  lte,
  desc,
  sql,
} from "@matrix-food/database";

/**
 * Formata um número Decimal/string/number em BRL com 2 casas.
 */
function fmtBRL(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseRange(input: { from: string; to: string }) {
  const from = new Date(input.from);
  const to = new Date(input.to);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new Error("Datas inválidas. Use formato ISO (YYYY-MM-DD).");
  }
  // Inclusivo até o fim do dia se to não tem hora
  if (input.to.length === 10) {
    to.setHours(23, 59, 59, 999);
  }
  return { from, to };
}

/**
 * Conjunto de ferramentas do Morpheu pra leitura de dados do tenant.
 * Todas recebem `tenantId` fixo no closure — isolamento multi-tenant.
 */
export function createMorpheuTools(tenantId: string) {
  return {
    getSalesByRange: tool({
      description:
        "Retorna faturamento total, quantidade de pedidos e ticket médio num intervalo. Use sempre que perguntarem 'quanto vendi' num período.",
      inputSchema: z.object({
        from: z.string().describe("Data início ISO, ex: 2026-04-01"),
        to: z.string().describe("Data fim ISO, ex: 2026-04-18"),
      }),
      execute: async (input) => {
        const { from, to } = parseRange(input);
        const db = getDb();
        const [row] = await db
          .select({
            totalRevenue: sql<number>`COALESCE(SUM(${orders.total}::numeric),0)::numeric`,
            ordersCount: sql<number>`count(*)::int`,
          })
          .from(orders)
          .where(
            and(
              eq(orders.tenantId, tenantId),
              gte(orders.createdAt, from),
              lte(orders.createdAt, to),
              sql`${orders.status} <> 'CANCELLED'`
            )
          );
        const revenue = Number(row?.totalRevenue ?? 0);
        const count = row?.ordersCount ?? 0;
        const avg = count > 0 ? revenue / count : 0;
        return {
          from: input.from,
          to: input.to,
          totalRevenue: `R$ ${fmtBRL(revenue)}`,
          totalRevenueNumber: revenue,
          ordersCount: count,
          averageTicket: `R$ ${fmtBRL(avg)}`,
        };
      },
    }),

    compareSalesRanges: tool({
      description:
        "Compara faturamento entre dois períodos (rangeA vs rangeB) e retorna variação absoluta e percentual. rangeA é o período 'atual', rangeB o 'de referência'.",
      inputSchema: z.object({
        rangeA: z.object({ from: z.string(), to: z.string() }),
        rangeB: z.object({ from: z.string(), to: z.string() }),
      }),
      execute: async ({ rangeA, rangeB }) => {
        const db = getDb();
        async function sumRange(r: { from: string; to: string }) {
          const { from, to } = parseRange(r);
          const [row] = await db
            .select({
              total: sql<number>`COALESCE(SUM(${orders.total}::numeric),0)::numeric`,
              count: sql<number>`count(*)::int`,
            })
            .from(orders)
            .where(
              and(
                eq(orders.tenantId, tenantId),
                gte(orders.createdAt, from),
                lte(orders.createdAt, to),
                sql`${orders.status} <> 'CANCELLED'`
              )
            );
          return { total: Number(row?.total ?? 0), count: row?.count ?? 0 };
        }
        const a = await sumRange(rangeA);
        const b = await sumRange(rangeB);
        const absDelta = a.total - b.total;
        const pctDelta = b.total > 0 ? (absDelta / b.total) * 100 : null;
        return {
          rangeA: {
            ...rangeA,
            totalRevenue: `R$ ${fmtBRL(a.total)}`,
            ordersCount: a.count,
          },
          rangeB: {
            ...rangeB,
            totalRevenue: `R$ ${fmtBRL(b.total)}`,
            ordersCount: b.count,
          },
          absoluteDifference: `R$ ${fmtBRL(absDelta)}`,
          percentDifference:
            pctDelta === null ? null : `${pctDelta.toFixed(1)}%`,
          direction: absDelta > 0 ? "up" : absDelta < 0 ? "down" : "flat",
        };
      },
    }),

    getOrdersList: tool({
      description:
        "Lista pedidos recentes. Útil pra perguntas tipo 'últimos pedidos', 'pedidos cancelados hoje'.",
      inputSchema: z.object({
        status: z
          .enum([
            "PENDING",
            "CONFIRMED",
            "PREPARING",
            "READY",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "PICKED_UP",
            "CANCELLED",
          ])
          .optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(10),
      }),
      execute: async (input) => {
        const db = getDb();
        const conds = [eq(orders.tenantId, tenantId)];
        if (input.status) conds.push(eq(orders.status, input.status));
        if (input.from && input.to) {
          const { from, to } = parseRange({ from: input.from, to: input.to });
          conds.push(gte(orders.createdAt, from));
          conds.push(lte(orders.createdAt, to));
        }
        const rows = await db
          .select({
            id: orders.id,
            orderNumber: orders.orderNumber,
            status: orders.status,
            total: orders.total,
            customerName: orders.customerName,
            createdAt: orders.createdAt,
            type: orders.type,
          })
          .from(orders)
          .where(and(...conds))
          .orderBy(desc(orders.createdAt))
          .limit(input.limit);
        return rows.map((o) => ({
          ...o,
          total: `R$ ${fmtBRL(o.total)}`,
        }));
      },
    }),

    getOrderById: tool({
      description:
        "Detalhes de um pedido específico pelo número (displayNumber, ex: '#0042' ou '0042').",
      inputSchema: z.object({
        orderNumber: z
          .string()
          .describe("Número de exibição do pedido, ex: #0042 ou 0042"),
      }),
      execute: async (input) => {
        const db = getDb();
        const clean = input.orderNumber.replace(/^#/, "").trim();
        const [order] = await db
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.tenantId, tenantId),
              eq(orders.displayNumber, clean)
            )
          )
          .limit(1);
        if (!order) return { error: "Pedido não encontrado." };
        const items = await db
          .select({
            name: orderItems.productName,
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
            totalPrice: orderItems.totalPrice,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id));
        return {
          orderNumber: order.displayNumber,
          status: order.status,
          total: `R$ ${fmtBRL(order.total)}`,
          type: order.type,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          createdAt: order.createdAt,
          items: items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unitPrice: `R$ ${fmtBRL(i.unitPrice)}`,
            totalPrice: `R$ ${fmtBRL(i.totalPrice)}`,
          })),
        };
      },
    }),

    getCashRegisterState: tool({
      description:
        "Retorna o caixa aberto atualmente (se houver) com saldo inicial, quem abriu e há quanto tempo está aberto.",
      inputSchema: z.object({}),
      execute: async () => {
        const db = getDb();
        const [row] = await db
          .select()
          .from(cashRegisterSessions)
          .where(
            and(
              eq(cashRegisterSessions.tenantId, tenantId),
              eq(cashRegisterSessions.status, "OPEN")
            )
          )
          .orderBy(desc(cashRegisterSessions.openedAt))
          .limit(1);
        if (!row) return { open: false };
        return {
          open: true,
          openedAt: row.openedAt,
          openedBy: row.openedBy,
          openingBalance: `R$ ${fmtBRL(row.openingBalance)}`,
        };
      },
    }),

    getTopProducts: tool({
      description:
        "Top N produtos mais vendidos num período (por quantidade e por faturamento).",
      inputSchema: z.object({
        from: z.string(),
        to: z.string(),
        limit: z.number().int().min(1).max(20).default(5),
      }),
      execute: async (input) => {
        const { from, to } = parseRange(input);
        const db = getDb();
        const rows = await db
          .select({
            productName: orderItems.productName,
            qty: sql<number>`SUM(${orderItems.quantity})::int`,
            revenue: sql<number>`SUM(${orderItems.totalPrice}::numeric)::numeric`,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .where(
            and(
              eq(orders.tenantId, tenantId),
              gte(orders.createdAt, from),
              lte(orders.createdAt, to),
              sql`${orders.status} <> 'CANCELLED'`
            )
          )
          .groupBy(orderItems.productName)
          .orderBy(desc(sql`SUM(${orderItems.quantity})`))
          .limit(input.limit);
        return rows.map((r) => ({
          product: r.productName,
          quantity: r.qty,
          revenue: `R$ ${fmtBRL(r.revenue)}`,
        }));
      },
    }),

    getCategoryPerformance: tool({
      description: "Faturamento por categoria num período.",
      inputSchema: z.object({
        from: z.string(),
        to: z.string(),
      }),
      execute: async (input) => {
        const { from, to } = parseRange(input);
        const db = getDb();
        const rows = await db
          .select({
            categoryId: categories.id,
            categoryName: categories.name,
            qty: sql<number>`COALESCE(SUM(${orderItems.quantity}),0)::int`,
            revenue: sql<number>`COALESCE(SUM(${orderItems.totalPrice}::numeric),0)::numeric`,
          })
          .from(categories)
          .leftJoin(products, eq(products.categoryId, categories.id))
          .leftJoin(orderItems, eq(orderItems.productId, products.id))
          .leftJoin(
            orders,
            and(
              eq(orders.id, orderItems.orderId),
              gte(orders.createdAt, from),
              lte(orders.createdAt, to),
              sql`${orders.status} <> 'CANCELLED'`
            )
          )
          .where(eq(categories.tenantId, tenantId))
          .groupBy(categories.id, categories.name)
          .orderBy(desc(sql`COALESCE(SUM(${orderItems.totalPrice}::numeric),0)`));
        return rows.map((r) => ({
          category: r.categoryName,
          quantity: r.qty,
          revenue: `R$ ${fmtBRL(r.revenue)}`,
        }));
      },
    }),

    searchCustomers: tool({
      description: "Busca clientes por nome ou telefone.",
      inputSchema: z.object({
        query: z.string().min(2),
        limit: z.number().int().min(1).max(20).default(5),
      }),
      execute: async (input) => {
        const db = getDb();
        const rows = await db
          .select({
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
          })
          .from(customers)
          .where(
            sql`${customers.name} ILIKE ${"%" + input.query + "%"} OR ${customers.phone} ILIKE ${"%" + input.query + "%"}`
          )
          .limit(input.limit);
        return rows;
      },
    }),
  };
}

export type MorpheuTools = ReturnType<typeof createMorpheuTools>;
