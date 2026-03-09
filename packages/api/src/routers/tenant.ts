import { z } from "zod";
import { createTRPCRouter, publicProcedure, tenantProcedure } from "../trpc";
import { getDb, tenants, eq } from "@matrix-food/database";

export const tenantRouter = createTRPCRouter({
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
