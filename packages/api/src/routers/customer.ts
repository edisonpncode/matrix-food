import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure } from "../trpc";
import {
  getDb,
  customers,
  customerTenants,
  orders,
  eq,
  and,
  or,
  desc,
  sql,
  ilike,
} from "@matrix-food/database";

/**
 * Schema de endereço reutilizado em várias procedures.
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

export const customerRouter = createTRPCRouter({
  /**
   * Busca cliente por telefone (normaliza para apenas dígitos antes de comparar).
   */
  searchByPhone: tenantProcedure
    .input(z.object({ phone: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const phoneDigits = input.phone.replace(/\D/g, "");
      if (!phoneDigits) return null;

      const [customer] = await db
        .select()
        .from(customers)
        .where(
          sql`regexp_replace(${customers.phone}, '\\D', '', 'g') = ${phoneDigits}`
        )
        .limit(1);

      if (!customer) {
        return null;
      }

      const [tenantStats] = await db
        .select()
        .from(customerTenants)
        .where(
          and(
            eq(customerTenants.customerId, customer.id),
            eq(customerTenants.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      return { ...customer, tenantStats: tenantStats ?? null };
    }),

  /**
   * Busca cliente por CPF (normaliza para apenas dígitos antes de comparar).
   */
  searchByCpf: tenantProcedure
    .input(z.object({ cpf: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const cpfDigits = input.cpf.replace(/\D/g, "");
      if (!cpfDigits) return null;

      const [customer] = await db
        .select()
        .from(customers)
        .where(
          sql`regexp_replace(${customers.cpf}, '\\D', '', 'g') = ${cpfDigits}`
        )
        .limit(1);

      if (!customer) {
        return null;
      }

      const [tenantStats] = await db
        .select()
        .from(customerTenants)
        .where(
          and(
            eq(customerTenants.customerId, customer.id),
            eq(customerTenants.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      return { ...customer, tenantStats: tenantStats ?? null };
    }),

  /**
   * Busca progressiva de clientes — retorna até 10 resultados enquanto o
   * atendente digita. Compara por telefone, CPF (apenas dígitos, parcial) e
   * nome (ilike). Mínimo 2 caracteres.
   */
  quickSearch: tenantProcedure
    .input(z.object({ query: z.string().min(2) }))
    .query(async ({ input }) => {
      const db = getDb();
      const raw = input.query.trim();
      const digits = raw.replace(/\D/g, "");
      const textPattern = `%${raw}%`;

      const conditions = [ilike(customers.name, textPattern)];

      if (digits.length >= 2) {
        conditions.push(
          sql`regexp_replace(${customers.phone}, '\\D', '', 'g') LIKE ${"%" + digits + "%"}`
        );
        conditions.push(
          sql`regexp_replace(coalesce(${customers.cpf},''), '\\D', '', 'g') LIKE ${"%" + digits + "%"}`
        );
      }

      const results = await db
        .select({
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
          cpf: customers.cpf,
          addresses: customers.addresses,
        })
        .from(customers)
        .where(or(...conditions))
        .orderBy(customers.name)
        .limit(10);

      return results;
    }),

  /**
   * Busca clientes por nome, telefone ou CPF (paginado).
   * Retorna apenas clientes que possuem vínculo com este tenant.
   */
  search: tenantProcedure
    .input(
      z.object({
        query: z.string().min(1),
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;
      const searchPattern = `%${input.query}%`;

      const results = await db
        .select({
          id: customers.id,
          firebaseUid: customers.firebaseUid,
          name: customers.name,
          email: customers.email,
          phone: customers.phone,
          cpf: customers.cpf,
          addresses: customers.addresses,
          createdAt: customers.createdAt,
          updatedAt: customers.updatedAt,
          loyaltyPointsBalance: customerTenants.loyaltyPointsBalance,
          totalOrders: customerTenants.totalOrders,
          totalSpent: customerTenants.totalSpent,
          firstOrderAt: customerTenants.firstOrderAt,
          lastOrderAt: customerTenants.lastOrderAt,
          isBlocked: customerTenants.isBlocked,
        })
        .from(customers)
        .innerJoin(
          customerTenants,
          and(
            eq(customerTenants.customerId, customers.id),
            eq(customerTenants.tenantId, ctx.tenantId)
          )
        )
        .where(
          or(
            ilike(customers.name, searchPattern),
            ilike(customers.phone, searchPattern),
            ilike(customers.cpf, searchPattern)
          )
        )
        .orderBy(customers.name)
        .limit(input.limit)
        .offset(offset);

      const [countResult] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(customers)
        .innerJoin(
          customerTenants,
          and(
            eq(customerTenants.customerId, customers.id),
            eq(customerTenants.tenantId, ctx.tenantId)
          )
        )
        .where(
          or(
            ilike(customers.name, searchPattern),
            ilike(customers.phone, searchPattern),
            ilike(customers.cpf, searchPattern)
          )
        );

      return {
        items: results,
        total: countResult?.total ?? 0,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil((countResult?.total ?? 0) / input.limit),
      };
    }),

  /**
   * Busca cliente por ID com stats do tenant.
   */
  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, input.id))
        .limit(1);

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente não encontrado.",
        });
      }

      const [tenantStats] = await db
        .select()
        .from(customerTenants)
        .where(
          and(
            eq(customerTenants.customerId, customer.id),
            eq(customerTenants.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      return { ...customer, tenantStats: tenantStats ?? null };
    }),

  /**
   * Cria um novo cliente ou vincula um existente ao tenant.
   */
  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        phone: z.string().min(1).max(20),
        cpf: z.string().max(14).optional(),
        email: z.string().email().optional(),
        source: z.string().max(50).optional(),
        address: addressSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verificar se já existe cliente com mesmo telefone
      const [existing] = await db
        .select()
        .from(customers)
        .where(eq(customers.phone, input.phone))
        .limit(1);

      if (existing) {
        // Verificar se já tem vínculo com este tenant
        const [existingTenant] = await db
          .select()
          .from(customerTenants)
          .where(
            and(
              eq(customerTenants.customerId, existing.id),
              eq(customerTenants.tenantId, ctx.tenantId)
            )
          )
          .limit(1);

        if (!existingTenant) {
          // Criar vínculo com o tenant
          await db.insert(customerTenants).values({
            customerId: existing.id,
            tenantId: ctx.tenantId,
          });
        }

        return existing;
      }

      // Criar novo cliente
      const addresses = input.address ? [input.address] : [];

      const [created] = await db
        .insert(customers)
        .values({
          name: input.name,
          phone: input.phone,
          cpf: input.cpf ?? null,
          email: input.email ?? null,
          source: input.source ?? "MANUAL",
          addresses,
        })
        .returning();

      // Criar vínculo com o tenant
      await db.insert(customerTenants).values({
        customerId: created!.id,
        tenantId: ctx.tenantId,
      });

      return created;
    }),

  /**
   * Atualiza dados de um cliente.
   */
  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        phone: z.string().min(1).max(20).optional(),
        cpf: z.string().max(14).nullable().optional(),
        email: z.string().email().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...data } = input;

      // Verificar se o cliente existe e pertence a este tenant
      const [tenantLink] = await db
        .select()
        .from(customerTenants)
        .where(
          and(
            eq(customerTenants.customerId, id),
            eq(customerTenants.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!tenantLink) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente não encontrado neste restaurante.",
        });
      }

      const [updated] = await db
        .update(customers)
        .set(data)
        .where(eq(customers.id, id))
        .returning();

      return updated;
    }),

  /**
   * Adiciona um endereço ao cliente.
   */
  addAddress: tenantProcedure
    .input(
      z.object({
        customerId: z.string().uuid(),
        address: addressSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verificar vínculo com tenant
      const [tenantLink] = await db
        .select()
        .from(customerTenants)
        .where(
          and(
            eq(customerTenants.customerId, input.customerId),
            eq(customerTenants.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!tenantLink) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente não encontrado neste restaurante.",
        });
      }

      // Buscar endereços atuais
      const [customer] = await db
        .select({ addresses: customers.addresses })
        .from(customers)
        .where(eq(customers.id, input.customerId))
        .limit(1);

      const currentAddresses = customer?.addresses ?? [];
      const updatedAddresses = [...currentAddresses, input.address];

      const [updated] = await db
        .update(customers)
        .set({ addresses: updatedAddresses })
        .where(eq(customers.id, input.customerId))
        .returning();

      return updated;
    }),

  /**
   * Remove um endereço do cliente por índice.
   */
  removeAddress: tenantProcedure
    .input(
      z.object({
        customerId: z.string().uuid(),
        index: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verificar vínculo com tenant
      const [tenantLink] = await db
        .select()
        .from(customerTenants)
        .where(
          and(
            eq(customerTenants.customerId, input.customerId),
            eq(customerTenants.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!tenantLink) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente não encontrado neste restaurante.",
        });
      }

      // Buscar endereços atuais
      const [customer] = await db
        .select({ addresses: customers.addresses })
        .from(customers)
        .where(eq(customers.id, input.customerId))
        .limit(1);

      const currentAddresses = customer?.addresses ?? [];

      if (input.index >= currentAddresses.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Índice de endereço inválido.",
        });
      }

      const updatedAddresses = currentAddresses.filter(
        (_, i) => i !== input.index
      );

      const [updated] = await db
        .update(customers)
        .set({ addresses: updatedAddresses })
        .where(eq(customers.id, input.customerId))
        .returning();

      return updated;
    }),

  /**
   * Lista os melhores clientes por total gasto (paginado).
   */
  listTopCustomers: tenantProcedure
    .input(
      z.object({
        query: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;

      const searchCondition = input.query
        ? or(
            ilike(customers.name, `%${input.query}%`),
            ilike(customers.phone, `%${input.query}%`),
            ilike(customers.cpf, `%${input.query}%`)
          )
        : undefined;

      const baseCondition = eq(customerTenants.tenantId, ctx.tenantId);

      const whereCondition = searchCondition
        ? and(baseCondition, searchCondition)
        : baseCondition;

      const results = await db
        .select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          phone: customers.phone,
          cpf: customers.cpf,
          source: customers.source,
          addresses: customers.addresses,
          createdAt: customers.createdAt,
          loyaltyPointsBalance: customerTenants.loyaltyPointsBalance,
          totalOrders: customerTenants.totalOrders,
          totalSpent: customerTenants.totalSpent,
          firstOrderAt: customerTenants.firstOrderAt,
          lastOrderAt: customerTenants.lastOrderAt,
          isBlocked: customerTenants.isBlocked,
        })
        .from(customers)
        .innerJoin(
          customerTenants,
          eq(customerTenants.customerId, customers.id)
        )
        .where(whereCondition)
        .orderBy(desc(customerTenants.totalSpent))
        .limit(input.limit)
        .offset(offset);

      const [countResult] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(customers)
        .innerJoin(
          customerTenants,
          eq(customerTenants.customerId, customers.id)
        )
        .where(whereCondition);

      return {
        items: results,
        total: countResult?.total ?? 0,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil((countResult?.total ?? 0) / input.limit),
      };
    }),

  /**
   * Retorna o histórico de pedidos de um cliente (paginado).
   */
  getOrderHistory: tenantProcedure
    .input(
      z.object({
        customerId: z.string().uuid(),
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;

      const results = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          displayNumber: orders.displayNumber,
          status: orders.status,
          type: orders.type,
          customerName: orders.customerName,
          customerPhone: orders.customerPhone,
          subtotal: orders.subtotal,
          deliveryFee: orders.deliveryFee,
          discount: orders.discount,
          total: orders.total,
          paymentMethod: orders.paymentMethod,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            eq(orders.customerId, input.customerId)
          )
        )
        .orderBy(desc(orders.createdAt))
        .limit(input.limit)
        .offset(offset);

      const [countResult] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            eq(orders.customerId, input.customerId)
          )
        );

      return {
        items: results,
        total: countResult?.total ?? 0,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil((countResult?.total ?? 0) / input.limit),
      };
    }),

  /**
   * Remove um cliente (e seus vínculos com o tenant).
   * Os pedidos são preservados (customerId será null via onDelete: set null).
   */
  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verificar se o cliente pertence a este tenant
      const [tenantLink] = await db
        .select()
        .from(customerTenants)
        .where(
          and(
            eq(customerTenants.customerId, input.id),
            eq(customerTenants.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!tenantLink) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cliente não encontrado neste restaurante.",
        });
      }

      // Remover vínculo com o tenant
      await db
        .delete(customerTenants)
        .where(eq(customerTenants.id, tenantLink.id));

      // Verificar se o cliente tem vínculo com outros tenants
      const [otherLinks] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(customerTenants)
        .where(eq(customerTenants.customerId, input.id));

      // Se não tem mais vínculos, deletar o cliente completamente
      if ((otherLinks?.count ?? 0) === 0) {
        await db.delete(customers).where(eq(customers.id, input.id));
      }

      return { success: true };
    }),
});
