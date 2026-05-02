import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  customerProcedure,
} from "../trpc";
import {
  getDb,
  customers,
  customerTenants,
  tenants,
  orders,
  orderItems,
  orderItemCustomizations,
  orderItemIngredients,
  loyaltyTransactions,
  eq,
  and,
  desc,
  sql,
  ne,
} from "@matrix-food/database";
import { rateLimit } from "../lib/rate-limit";
import { cleanCpf, isValidCpf } from "@matrix-food/utils";
import { calculateExpiration } from "../services/loyalty/expiration";

/**
 * Schema de endereço do cliente.
 */
const addressSchema = z.object({
  label: z.string().min(1),
  street: z.string().min(1),
  number: z.string().min(1),
  complement: z.string().optional(),
  neighborhood: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().default(""),
  referencePoint: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

/**
 * Normaliza telefone removendo caracteres não numéricos.
 * Mantém os últimos 11 dígitos (DDD + número) — Brasil.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Remove código do país (+55) se presente
  if (digits.length > 11 && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
}

export const customerPortalRouter = createTRPCRouter({
  /**
   * Vincula o firebaseUid ao customer existente (busca por telefone).
   * Se não existir, cria um novo customer.
   * Chamado logo após o login/signup via Firebase Phone Auth.
   *
   * É público porque o middleware customerProcedure depende do ctx.customer
   * estar populado, e isso só acontece DEPOIS deste link inicial em sessões
   * onde o cookie ainda não existe. Mesmo assim, exigimos o firebaseUid e
   * o telefone — que só são fornecidos pelo cliente Firebase autenticado
   * (via /api/auth/session do app cliente).
   */
  linkOrCreate: publicProcedure
    .input(
      z.object({
        firebaseUid: z.string().min(1),
        phone: z.string().min(8),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      rateLimit("customerPortal.linkOrCreate", ctx.ip ?? "", {
        limit: 10,
        windowMs: 60_000,
      });
      const db = getDb();
      const phone = normalizePhone(input.phone);

      // 1. Já existe customer com este firebaseUid?
      const [byUid] = await db
        .select()
        .from(customers)
        .where(eq(customers.firebaseUid, input.firebaseUid))
        .limit(1);

      if (byUid) return byUid;

      // 2. Existe customer com este telefone? Vincula.
      const [byPhone] = await db
        .select()
        .from(customers)
        .where(eq(customers.phone, phone))
        .limit(1);

      if (byPhone) {
        const updates: Record<string, unknown> = {
          firebaseUid: input.firebaseUid,
        };
        if (input.name && (!byPhone.name || byPhone.name === "Balcão")) {
          updates.name = input.name;
        }
        const [updated] = await db
          .update(customers)
          .set(updates)
          .where(eq(customers.id, byPhone.id))
          .returning();
        return updated ?? byPhone;
      }

      // 3. Cria novo customer.
      const [created] = await db
        .insert(customers)
        .values({
          firebaseUid: input.firebaseUid,
          name: input.name?.trim() || "Cliente",
          phone,
          source: "PORTAL",
          addresses: [],
        })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar cliente.",
        });
      }
      return created;
    }),

  /**
   * Retorna os dados do cliente logado.
   * Busca por customerId (HMAC cookie) ou firebaseUid (Firebase Phone Auth).
   */
  getMe: customerProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const where = ctx.customer.customerId
      ? eq(customers.id, ctx.customer.customerId)
      : eq(customers.firebaseUid, ctx.customer.uid!);
    const [customer] = await db.select().from(customers).where(where).limit(1);

    if (!customer) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Cliente não encontrado. Faça o cadastro primeiro.",
      });
    }
    return customer;
  }),

  /**
   * Atualiza dados do cliente logado (perfil).
   */
  updateMe: customerProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional().nullable(),
        cpf: z.string().optional().nullable(),
        addresses: z.array(addressSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.email !== undefined) updates.email = input.email;
      if (input.addresses !== undefined) updates.addresses = input.addresses;

      const where = ctx.customer.customerId
        ? eq(customers.id, ctx.customer.customerId)
        : eq(customers.firebaseUid, ctx.customer.uid!);

      if (input.cpf !== undefined) {
        if (input.cpf === null || input.cpf === "") {
          updates.cpf = null;
        } else {
          const cleaned = cleanCpf(input.cpf);
          if (!isValidCpf(cleaned)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "CPF inválido.",
            });
          }
          const [me] = await db
            .select({ id: customers.id })
            .from(customers)
            .where(where)
            .limit(1);
          if (!me) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Cliente não encontrado.",
            });
          }
          const [conflict] = await db
            .select({ id: customers.id })
            .from(customers)
            .where(and(eq(customers.cpf, cleaned), ne(customers.id, me.id)))
            .limit(1);
          if (conflict) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Este CPF já está cadastrado em outra conta.",
            });
          }
          updates.cpf = cleaned;
        }
      }

      if (Object.keys(updates).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nada para atualizar.",
        });
      }

      const [updated] = await db
        .update(customers)
        .set(updates)
        .where(where)
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente não encontrado.",
        });
      }
      return updated;
    }),

  /**
   * Lista os pedidos do cliente logado, opcionalmente filtrados por restaurante.
   */
  getMyOrders: customerProcedure
    .input(
      z
        .object({
          tenantId: z.string().uuid().optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const customerWhere = ctx.customer.customerId
        ? eq(customers.id, ctx.customer.customerId)
        : eq(customers.firebaseUid, ctx.customer.uid!);
      const [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(customerWhere)
        .limit(1);
      if (!customer) return [];

      const limit = input?.limit ?? 50;
      const where = input?.tenantId
        ? and(
            eq(orders.customerId, customer.id),
            eq(orders.tenantId, input.tenantId)
          )
        : eq(orders.customerId, customer.id);

      const rows = await db
        .select({
          id: orders.id,
          tenantId: orders.tenantId,
          tenantName: tenants.name,
          tenantSlug: tenants.slug,
          displayNumber: orders.displayNumber,
          status: orders.status,
          type: orders.type,
          total: orders.total,
          loyaltyPointsEarned: orders.loyaltyPointsEarned,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .innerJoin(tenants, eq(orders.tenantId, tenants.id))
        .where(where)
        .orderBy(desc(orders.createdAt))
        .limit(limit);
      return rows;
    }),

  /**
   * Saldo de pontos do cliente logado em cada restaurante.
   */
  getMyLoyalty: customerProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const customerWhere = ctx.customer.customerId
      ? eq(customers.id, ctx.customer.customerId)
      : eq(customers.firebaseUid, ctx.customer.uid!);
    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(customerWhere)
      .limit(1);
    if (!customer) return [];

    const rows = await db
      .select({
        tenantId: customerTenants.tenantId,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        tenantLogoUrl: tenants.logoUrl,
        loyaltyPointsBalance: customerTenants.loyaltyPointsBalance,
        totalOrders: customerTenants.totalOrders,
        totalSpent: customerTenants.totalSpent,
        lastOrderAt: customerTenants.lastOrderAt,
      })
      .from(customerTenants)
      .innerJoin(tenants, eq(customerTenants.tenantId, tenants.id))
      .where(eq(customerTenants.customerId, customer.id))
      .orderBy(desc(customerTenants.lastOrderAt));
    return rows;
  }),

  /**
   * Extrato de pontos do cliente em um restaurante específico.
   * Inclui saldo materializado, totais ganhos/gastos e lista de transações.
   */
  getMyLoyaltyTransactions: customerProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        limit: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const customerWhere = ctx.customer.customerId
        ? eq(customers.id, ctx.customer.customerId)
        : eq(customers.firebaseUid, ctx.customer.uid!);
      const [customer] = await db
        .select({ id: customers.id, phone: customers.phone })
        .from(customers)
        .where(customerWhere)
        .limit(1);
      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente não encontrado.",
        });
      }

      const [tenant] = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          logoUrl: tenants.logoUrl,
        })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);
      if (!tenant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Restaurante não encontrado.",
        });
      }

      const [link] = await db
        .select({ balance: customerTenants.loyaltyPointsBalance })
        .from(customerTenants)
        .where(
          and(
            eq(customerTenants.customerId, customer.id),
            eq(customerTenants.tenantId, input.tenantId)
          )
        )
        .limit(1);

      const phoneFilter = customer.phone ?? "";

      const [aggregates] = await db
        .select({
          totalEarned: sql<number>`COALESCE(SUM(CASE WHEN ${loyaltyTransactions.points} > 0 THEN ${loyaltyTransactions.points} ELSE 0 END), 0)::int`,
          totalRedeemed: sql<number>`COALESCE(SUM(CASE WHEN ${loyaltyTransactions.points} < 0 THEN ABS(${loyaltyTransactions.points}) ELSE 0 END), 0)::int`,
        })
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.tenantId, input.tenantId),
            eq(loyaltyTransactions.customerPhone, phoneFilter)
          )
        );

      const transactions = await db
        .select({
          id: loyaltyTransactions.id,
          type: loyaltyTransactions.type,
          points: loyaltyTransactions.points,
          description: loyaltyTransactions.description,
          orderId: loyaltyTransactions.orderId,
          orderDisplayNumber: orders.displayNumber,
          createdAt: loyaltyTransactions.createdAt,
          expiresAt: loyaltyTransactions.expiresAt,
        })
        .from(loyaltyTransactions)
        .leftJoin(orders, eq(loyaltyTransactions.orderId, orders.id))
        .where(
          and(
            eq(loyaltyTransactions.tenantId, input.tenantId),
            eq(loyaltyTransactions.customerPhone, phoneFilter)
          )
        )
        .orderBy(desc(loyaltyTransactions.createdAt))
        .limit(input.limit);

      // Próxima expiração: roda FIFO virtual nas transações trazidas.
      const fifo = calculateExpiration(transactions, new Date());

      return {
        tenant,
        balance: link?.balance ?? 0,
        totalEarned: aggregates?.totalEarned ?? 0,
        totalRedeemed: aggregates?.totalRedeemed ?? 0,
        transactions,
        nextExpiration: fifo.nextExpiration,
      };
    }),

  /**
   * Busca um pedido específico do cliente logado.
   * Autentica via sessão (HMAC cookie ou Firebase uid) e verifica que o pedido
   * pertence ao cliente — não precisa do token HMAC do `order.create`. Permite
   * abrir a tela de detalhe do pedido a partir de listagens internas (extrato
   * de pontos, pedidos da conta) sem reenviar tokens longos por URL.
   */
  getMyOrderById: customerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const customerWhere = ctx.customer.customerId
        ? eq(customers.id, ctx.customer.customerId)
        : eq(customers.firebaseUid, ctx.customer.uid!);
      const [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(customerWhere)
        .limit(1);
      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente não encontrado.",
        });
      }

      const [order] = await db
        .select()
        .from(orders)
        .where(
          and(eq(orders.id, input.id), eq(orders.customerId, customer.id))
        )
        .limit(1);

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido não encontrado.",
        });
      }

      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      const itemsWithDetails = await Promise.all(
        items.map(async (item) => {
          const customizations = await db
            .select()
            .from(orderItemCustomizations)
            .where(eq(orderItemCustomizations.orderItemId, item.id));
          const ingredientMods = await db
            .select()
            .from(orderItemIngredients)
            .where(eq(orderItemIngredients.orderItemId, item.id));
          return {
            ...item,
            customizations,
            ingredientModifications: ingredientMods,
          };
        })
      );

      // Remove lat/lng do endereço — mesma política da rota pública.
      let sanitizedAddress: unknown = order.deliveryAddress;
      if (sanitizedAddress && typeof sanitizedAddress === "object") {
        const rest = { ...(sanitizedAddress as Record<string, unknown>) };
        delete rest.latitude;
        delete rest.longitude;
        sanitizedAddress = rest;
      }

      return {
        ...order,
        deliveryAddress: sanitizedAddress,
        items: itemsWithDetails,
      };
    }),

  /**
   * Garante que o cliente logado tem um vínculo com o tenant informado.
   * Usado quando o cliente abre uma página de restaurante onde ainda não pediu.
   * Idempotente — não faz nada se o vínculo já existe.
   */
  ensureTenantLink: customerProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const customerWhere = ctx.customer.customerId
        ? eq(customers.id, ctx.customer.customerId)
        : eq(customers.firebaseUid, ctx.customer.uid!);
      const [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(customerWhere)
        .limit(1);
      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente não encontrado.",
        });
      }

      const [existing] = await db
        .select({ customerId: customerTenants.customerId })
        .from(customerTenants)
        .where(
          and(
            eq(customerTenants.customerId, customer.id),
            eq(customerTenants.tenantId, input.tenantId)
          )
        )
        .limit(1);

      if (existing) return { created: false };

      await db
        .insert(customerTenants)
        .values({
          customerId: customer.id,
          tenantId: input.tenantId,
        })
        .onConflictDoNothing();

      return { created: true };
    }),
});
