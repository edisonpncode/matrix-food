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
  eq,
  and,
  desc,
} from "@matrix-food/database";

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
  zipCode: z.string().min(1),
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
    .mutation(async ({ input }) => {
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
   */
  getMe: customerProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.firebaseUid, ctx.customer.uid))
      .limit(1);

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
      if (input.cpf !== undefined) updates.cpf = input.cpf;
      if (input.addresses !== undefined) updates.addresses = input.addresses;

      if (Object.keys(updates).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nada para atualizar.",
        });
      }

      const [updated] = await db
        .update(customers)
        .set(updates)
        .where(eq(customers.firebaseUid, ctx.customer.uid))
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
      const [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.firebaseUid, ctx.customer.uid))
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
    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.firebaseUid, ctx.customer.uid))
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
});
