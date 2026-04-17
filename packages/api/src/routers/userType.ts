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
 * Importante: ao adicionar um novo módulo aqui, atualizar também:
 *   - ALL_PERMISSION_KEYS (logo abaixo)
 *   - A sidebar (admin e pos) para filtrar por permissão
 *   - getAllPermissions() usado quando cria o tipo "Proprietário"
 */
export const AVAILABLE_PERMISSIONS = {
  dashboard: {
    label: "Dashboard",
    permissions: {
      "dashboard.view": "Ver Dashboard e relatórios",
    },
  },
  pos: {
    label: "Ponto de Venda",
    permissions: {
      "pos.view": "Acessar o Ponto de Venda (POS)",
      "pos.createOrder": "Criar novos pedidos pelo POS",
    },
  },
  orders: {
    label: "Pedidos",
    permissions: {
      "orders.view": "Ver pedidos",
      "orders.manage": "Confirmar, preparar e alterar status de pedidos",
      "orders.cancel": "Cancelar pedidos",
      "orders.discount": "Aplicar descontos em pedidos",
    },
  },
  cashRegister: {
    label: "Caixa",
    permissions: {
      "cashRegister.view": "Ver caixa",
      "cashRegister.manage": "Abrir, fechar caixa e fazer sangrias",
      "cashRegister.viewTotals":
        "Ver valores de vendas e saldo atual no caixa",
    },
  },
  motoboys: {
    label: "Motoboys / Entregas",
    permissions: {
      "motoboys.view": "Ver motoboys e entregas",
      "motoboys.manage": "Atribuir motoboys e finalizar entregas",
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
  ingredients: {
    label: "Ingredientes",
    permissions: {
      "ingredients.view": "Ver ingredientes",
      "ingredients.manage": "Criar, editar e excluir ingredientes",
    },
  },
  promotions: {
    label: "Promoções",
    permissions: {
      "promotions.view": "Ver promoções",
      "promotions.manage": "Criar, editar e excluir promoções",
    },
  },
  customers: {
    label: "Clientes",
    permissions: {
      "customers.view": "Ver clientes",
      "customers.manage": "Editar dados de clientes",
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
  deliveryAreas: {
    label: "Áreas de Entrega",
    permissions: {
      "deliveryAreas.view": "Ver áreas de entrega",
      "deliveryAreas.manage": "Criar, editar e excluir áreas de entrega",
    },
  },
  settings: {
    label: "Configurações",
    permissions: {
      "settings.view": "Ver configurações do restaurante",
      "settings.manage": "Alterar configurações do restaurante",
    },
  },
  printer: {
    label: "Impressora",
    permissions: {
      "printer.manage": "Configurar impressora e impressão",
    },
  },
  fiscal: {
    label: "Nota Fiscal",
    permissions: {
      "fiscal.view": "Ver notas fiscais e histórico",
      "fiscal.manage": "Emitir e cancelar notas fiscais",
      "fiscal.configure": "Configurar provedor fiscal",
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
  billing: {
    label: "Assinatura",
    permissions: {
      "billing.view": "Ver plano e cobranças",
      "billing.manage": "Alterar plano e dados de pagamento",
    },
  },
} as const;

/**
 * Lista plana de todas as keys de permissão. Usado para criar o
 * tipo "Proprietário" com todas as permissões habilitadas.
 */
export const ALL_PERMISSION_KEYS: string[] = Object.values(
  AVAILABLE_PERMISSIONS
).flatMap((module) => Object.keys(module.permissions));

/**
 * Retorna um objeto `{ [key]: true }` com TODAS as permissões do sistema.
 * Útil para seed do tipo "Proprietário" na criação do restaurante.
 */
export function getAllPermissions(): Record<string, boolean> {
  return ALL_PERMISSION_KEYS.reduce<Record<string, boolean>>((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});
}

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
   * Também sincroniza o tipo "Proprietário" (isSystem=true) caso esteja desatualizado
   * — garante que o dono do restaurante sempre tenha TODAS as permissões mais recentes.
   */
  getAvailablePermissions: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();
    try {
      const [ownerType] = await db
        .select()
        .from(userTypes)
        .where(
          and(
            eq(userTypes.tenantId, ctx.tenantId),
            eq(userTypes.isSystem, true)
          )
        )
        .limit(1);

      if (ownerType) {
        const current = (ownerType.permissions ?? {}) as Record<string, boolean>;
        const missing = ALL_PERMISSION_KEYS.filter((k) => current[k] !== true);
        if (missing.length > 0) {
          const updatedPerms = { ...current };
          for (const k of ALL_PERMISSION_KEYS) updatedPerms[k] = true;
          await db
            .update(userTypes)
            .set({ permissions: updatedPerms })
            .where(eq(userTypes.id, ownerType.id));
        }
      }
    } catch {
      // não bloqueia a rota se o sync falhar
    }
    return AVAILABLE_PERMISSIONS;
  }),

  /**
   * Força a sincronização do tipo "Proprietário" com todas as permissões
   * atuais do sistema. Retorna o tipo atualizado.
   */
  syncOwnerPermissions: tenantProcedure.mutation(async ({ ctx }) => {
    const db = getDb();
    const [ownerType] = await db
      .select()
      .from(userTypes)
      .where(
        and(
          eq(userTypes.tenantId, ctx.tenantId),
          eq(userTypes.isSystem, true)
        )
      )
      .limit(1);

    if (!ownerType) {
      throw new Error("Tipo 'Proprietário' não encontrado.");
    }

    const updatedPerms = getAllPermissions();
    const [updated] = await db
      .update(userTypes)
      .set({ permissions: updatedPerms })
      .where(eq(userTypes.id, ownerType.id))
      .returning();

    return updated;
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
