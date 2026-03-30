import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../trpc";
import { getDb, categories, products } from "@matrix-food/database";

const menuItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.string(),
});

const menuCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  products: z.array(menuItemSchema),
});

export const minimaxRouter = createTRPCRouter({
  /**
   * Importa cardápio extraído pela IA.
   * Cria categorias e produtos no banco de dados.
   */
  importMenu: tenantProcedure
    .input(
      z.object({
        categories: z.array(menuCategorySchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      let categoriesCreated = 0;
      let productsCreated = 0;

      for (let i = 0; i < input.categories.length; i++) {
        const cat = input.categories[i]!;

        const [createdCategory] = await db
          .insert(categories)
          .values({
            tenantId: ctx.tenantId,
            name: cat.name,
            description: cat.description,
            sortOrder: i,
            isActive: true,
          })
          .returning();

        if (!createdCategory) continue;
        categoriesCreated++;

        for (let j = 0; j < cat.products.length; j++) {
          const prod = cat.products[j]!;

          await db.insert(products).values({
            tenantId: ctx.tenantId,
            categoryId: createdCategory.id,
            name: prod.name,
            description: prod.description,
            price: prod.price,
            sortOrder: j,
            isActive: true,
          });

          productsCreated++;
        }
      }

      return { categoriesCreated, productsCreated };
    }),
});
