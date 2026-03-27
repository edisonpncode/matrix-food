import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../trpc";
import {
  getDb,
  userTypes,
  tenantUsers,
  eq,
  and,
  asc,
  count,
} from "@matrix-food/database";

/**
 * Todas as permissões disponíveis no sistema, agrupadas por módulo.
 */
export const AVAILABLE_PERMISSIONS = {
  dashboard: {
    label: "Dashboard",
    permissions: {
      "dashboard.view": "Ver Dashboard e relatórios",
    },
  },
  categories: {
    label: "Categorias",
    permissions: {
      "categories.view": "Ver categorias",
      "categories.manage": "Criar, editar e excluir categorias",
    },
  },
  products: {
    label: "Produtos",
    permissions: {
      "products.view": "Ver produtos",
      "products.manage": "Criar, editar e excluir produtos",
    },
  },
  orders: {
    label: "Pedidos",
    permissions: {
      "orders.view": "Ver pedidos",
      "orders.manage": "Confirmar, preparar e alterar status de pedidos",
      "orders.cancel": "Cancelar pedidos",
    },
  },
  cashRegister: {
    label: "Caixa",
    permissions: {
      "cashRegister.view": "Ver caixa",
      "cashRegister.manage": "Abrir, fechar caixa e fazer sangrias",
    },
  },
  promotions: {
    label: "Promoções",
    permissions: {
      "promotions.view": "Ver promoções",
      "promotions.manage": "Criar, editar e excluir promoções",
    },
  },
  loyalty: {
    label: "Fidelidade",
    permissions: {
      "loyalty.view": "Ver programa de fidelidade",
      "loyalty.manage": "Configurar fidelidade e recompensas",
    },
  },
  reviews: {
    label: "Avaliações",
    permissions: {
      "reviews.view": "Ver avaliações dos clientes",
      "reviews.manage": "Responder avaliações",
    },
  },
  billing: {
    label: "Assinatura",
    permissions: {
      "billing.view": "Ver plano e cobranças",
    },
  },
  settings: {
    label: "Configurações",
    permissions: {
      "settings.view": "Ver configurações do restaurante",
      "settings.manage": "Alterar configurações do restaurante",
    },
  },
  staff: {
    label: "Equipe",
    permissions: {
      "staff.view": "Ver funcionários e tipos de usuário",
      "staff.manage": "Gerenciar funcionários e tipos de usuário",
    },
  },
  activityLog: {
    label: "Log de Atividades",
    permissions: {
      "activityLog.view": "Ver log de atividades",
    },
  },
} as const;

export const userTypeRouter = createTRPCRouter({
  /**
   * Lista todos os tipos de usuário do restaurante.
   */
  list: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const types = await db
      .select()
      .from(userTypes)
      .where(eq(userTypes.tenantId, ctx.tenantId))
      .orderBy(asc(userTypes.name));

    // Contar quantos funcionários usam cada tipo
    const userCounts = await db
      .select({
        userTypeId: tenantUsers.userTypeId,
        count: count(),
      })
      .from(tenantUsers)
      .where(eq(tenantUsers.tenantId, ctx.tenantId))
      .groupBy(tenantUsers.userTypeId);

    const countMap = new Map(
      userCounts.map((uc) => [uc.userTypeId, Number(uc.count)])
    );

    return types.map((t) => ({
      ...t,
      usersCount: countMap.get(t.id) ?? 0,
    }));
  }),

  /**
   * Retorna as permissões disponíveis no sistema (para o frontend montar o formulário).
   */
  getAvailablePermissions: tenantProcedure.query(() => {
    return AVAILABLE_PERMISSIONS;
  }),

  /**
   * Busca um tipo de usuário por ID.
   */
  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [userType] = await getDb()
        .select()
        .from(userTypes)
        .where(
          and(
            eq(userTypes.id, input.id),
            eq(userTypes.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      return userType ?? null;
    }),

  /**
   * Cria um novo tipo de usuário.
   */
  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        permissions: z.record(z.string(), z.boolean()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await getDb()
        .insert(userTypes)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          description: input.description,
          permissions: input.permissions,
        })
        .returning();

      return created;
    }),

  /**
   * Atualiza um tipo de usuário.
   */
  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).nullable().optional(),
        permissions: z.record(z.string(), z.boolean()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await getDb()
        .update(userTypes)
        .set(data)
        .where(
          and(
            eq(userTypes.id, id),
            eq(userTypes.tenantId, ctx.tenantId),
            eq(userTypes.isSystem, false)
          )
        )
        .returning();

      return updated;
    }),

  /**
   * Deleta um tipo de usuário (apenas se não for do sistema e não tiver funcionários vinculados).
   */
  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verificar se tem funcionários usando este tipo
      const [usage] = await db
        .select({ count: count() })
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.tenantId, ctx.tenantId),
            eq(tenantUsers.userTypeId, input.id)
          )
        );

      if (usage && Number(usage.count) > 0) {
        throw new Error(
          `Não é possível excluir: ${usage.count} funcionário(s) estão usando este tipo de usuário.`
        );
      }

      const [deleted] = await db
        .delete(userTypes)
        .where(
          and(
            eq(userTypes.id, input.id),
            eq(userTypes.tenantId, ctx.tenantId),
            eq(userTypes.isSystem, false)
          )
        )
        .returning();

      return deleted;
    }),
});
