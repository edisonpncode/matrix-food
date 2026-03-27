import { z } from "zod";
import { createTRPCRouter, publicProcedure, tenantProcedure } from "../trpc";
import { getDb, tenants, tenantUsers, userTypes, eq } from "@matrix-food/database";
import { AVAILABLE_PERMISSIONS } from "./userType";

export const tenantRouter = createTRPCRouter({
  /**
   * Registra um novo restaurante (cadastro completo).
   * Público - cria tenant, tipo "Proprietário" e funcionário-dono.
   * A criação do Firebase Auth é feita no frontend antes de chamar isso.
   */
  register: publicProcedure
    .input(
      z.object({
        // Owner
        ownerName: z.string().min(1).max(255),
        ownerPhone: z.string().max(20).optional(),
        // Restaurant
        restaurantName: z.string().min(1).max(255),
        foodTypes: z.array(z.string()).min(1, "Selecione pelo menos um tipo"),
        state: z.string().length(2),
        city: z.string().min(1).max(100),
        // Login
        email: z.string().email(),
        firebaseUid: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Gerar slug a partir do nome
      const baseSlug = input.restaurantName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Verificar se slug já existe, se sim adiciona número
      let slug = baseSlug;
      let suffix = 1;
      while (true) {
        const [existing] = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.slug, slug))
          .limit(1);
        if (!existing) break;
        slug = `${baseSlug}-${suffix}`;
        suffix++;
      }

      // 1. Criar o tenant (restaurante)
      const [tenant] = await db
        .insert(tenants)
        .values({
          name: input.restaurantName,
          slug,
          foodTypes: input.foodTypes,
          state: input.state,
          city: input.city,
          email: input.email,
          phone: input.ownerPhone,
          whatsapp: input.ownerPhone,
        })
        .returning();

      if (!tenant) throw new Error("Erro ao criar restaurante.");

      // 2. Criar tipo de usuário "Proprietário" com TODAS as permissões
      const allPermissions: Record<string, boolean> = {};
      for (const group of Object.values(AVAILABLE_PERMISSIONS)) {
        for (const permKey of Object.keys(group.permissions)) {
          allPermissions[permKey] = true;
        }
      }

      const [ownerType] = await db
        .insert(userTypes)
        .values({
          tenantId: tenant.id,
          name: "Proprietário",
          description: "Acesso total ao sistema",
          permissions: allPermissions,
          isSystem: true,
        })
        .returning();

      // 3. Criar o funcionário-dono
      await db.insert(tenantUsers).values({
        tenantId: tenant.id,
        firebaseUid: input.firebaseUid,
        name: input.ownerName,
        email: input.email,
        phone: input.ownerPhone,
        role: "OWNER",
        userTypeId: ownerType?.id,
      });

      return { tenantId: tenant.id, slug: tenant.slug };
    }),
  /**
   * Busca restaurante pelo slug (URL).
   * Público - qualquer pessoa pode ver os dados básicos.
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input }) => {
      const [tenant] = await getDb()
        .select()
        .from(tenants)
        .where(eq(tenants.slug, input.slug))
        .limit(1);

      return tenant ?? null;
    }),

  /**
   * Busca restaurante pelo ID.
   * Requer pertencer ao tenant.
   */
  getById: tenantProcedure.query(async ({ ctx }) => {
    const [tenant] = await getDb()
      .select()
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    return tenant ?? null;
  }),

  /**
   * Atualiza dados do restaurante.
   * Requer pertencer ao tenant.
   */
  update: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        address: z.string().optional(),
        city: z.string().max(100).optional(),
        state: z.string().max(2).optional(),
        zipCode: z.string().max(10).optional(),
        phone: z.string().max(20).optional(),
        whatsapp: z.string().max(20).optional(),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await getDb()
        .update(tenants)
        .set(input)
        .where(eq(tenants.id, ctx.tenantId))
        .returning();

      return updated;
    }),
});
