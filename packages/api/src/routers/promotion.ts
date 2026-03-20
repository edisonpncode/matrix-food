import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, tenantProcedure } from "../trpc";
import {
  getDb,
  promotions,
  promotionItems,
  promotionUsage,
  products,
  categories,
  eq,
  and,
  sql,
  asc,
} from "@matrix-food/database";

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Schema para itens do combo
const promotionItemInput = z.object({
  productId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).default(1),
  role: z.enum(["REQUIRED", "FREE", "CHOICE"]).default("REQUIRED"),
  specialPrice: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const promotionRouter = createTRPCRouter({
  /**
   * Lista promoções do restaurante (admin).
   */
  list: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();

    const promoList = await db
      .select({
        id: promotions.id,
        code: promotions.code,
        description: promotions.description,
        type: promotions.type,
        value: promotions.value,
        bundlePrice: promotions.bundlePrice,
        daysOfWeek: promotions.daysOfWeek,
        timeStart: promotions.timeStart,
        timeEnd: promotions.timeEnd,
        imageUrl: promotions.imageUrl,
        maxChoices: promotions.maxChoices,
        minOrderValue: promotions.minOrderValue,
        maxDiscount: promotions.maxDiscount,
        maxUses: promotions.maxUses,
        maxUsesPerCustomer: promotions.maxUsesPerCustomer,
        startDate: promotions.startDate,
        endDate: promotions.endDate,
        isActive: promotions.isActive,
        createdAt: promotions.createdAt,
        usageCount: sql<number>`(
          SELECT COUNT(*) FROM promotion_usage
          WHERE promotion_usage.promotion_id = ${promotions.id}
        )::int`,
      })
      .from(promotions)
      .where(eq(promotions.tenantId, ctx.tenantId))
      .orderBy(promotions.createdAt);

    // Buscar itens de cada promoção combo
    const withItems = await Promise.all(
      promoList.map(async (promo) => {
        if (promo.type !== "COMBO" && promo.type !== "BUY_X_GET_Y") {
          return { ...promo, items: [] };
        }

        const items = await db
          .select({
            id: promotionItems.id,
            productId: promotionItems.productId,
            categoryId: promotionItems.categoryId,
            quantity: promotionItems.quantity,
            role: promotionItems.role,
            specialPrice: promotionItems.specialPrice,
            sortOrder: promotionItems.sortOrder,
            productName: products.name,
            categoryName: categories.name,
          })
          .from(promotionItems)
          .leftJoin(products, eq(promotionItems.productId, products.id))
          .leftJoin(categories, eq(promotionItems.categoryId, categories.id))
          .where(eq(promotionItems.promotionId, promo.id))
          .orderBy(asc(promotionItems.sortOrder));

        return { ...promo, items };
      })
    );

    return withItems;
  }),

  /**
   * Cria uma promoção (admin).
   */
  create: tenantProcedure
    .input(
      z.object({
        code: z
          .string()
          .min(1)
          .max(50)
          .transform((v) => v.toUpperCase().trim()),
        description: z.string().max(500).optional(),
        type: z.enum([
          "PERCENTAGE",
          "FIXED_AMOUNT",
          "FREE_DELIVERY",
          "COMBO",
          "BUY_X_GET_Y",
        ]),
        value: z.string().min(1),
        bundlePrice: z.string().optional(),
        daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
        timeStart: z.string().max(5).optional(),
        timeEnd: z.string().max(5).optional(),
        imageUrl: z.string().optional(),
        maxChoices: z.number().int().positive().optional(),
        minOrderValue: z.string().optional(),
        maxDiscount: z.string().optional(),
        maxUses: z.number().int().positive().optional(),
        maxUsesPerCustomer: z.number().int().positive().default(1),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        items: z.array(promotionItemInput).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verificar código único por tenant
      const [existing] = await db
        .select({ id: promotions.id })
        .from(promotions)
        .where(
          and(
            eq(promotions.tenantId, ctx.tenantId),
            eq(promotions.code, input.code)
          )
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Já existe uma promoção com o código "${input.code}"`,
        });
      }

      const [promo] = await db
        .insert(promotions)
        .values({
          tenantId: ctx.tenantId,
          code: input.code,
          description: input.description,
          type: input.type,
          value: input.value,
          bundlePrice: input.bundlePrice || null,
          daysOfWeek: input.daysOfWeek?.length ? input.daysOfWeek : null,
          timeStart: input.timeStart || null,
          timeEnd: input.timeEnd || null,
          imageUrl: input.imageUrl || null,
          maxChoices: input.maxChoices || null,
          minOrderValue: input.minOrderValue || null,
          maxDiscount: input.maxDiscount || null,
          maxUses: input.maxUses,
          maxUsesPerCustomer: input.maxUsesPerCustomer,
          startDate: input.startDate ? new Date(input.startDate) : new Date(),
          endDate: input.endDate ? new Date(input.endDate) : null,
        })
        .returning();

      // Inserir itens do combo se houver
      if (input.items && input.items.length > 0 && promo) {
        for (const item of input.items) {
          await db.insert(promotionItems).values({
            promotionId: promo.id,
            productId: item.productId || null,
            categoryId: item.categoryId || null,
            quantity: item.quantity,
            role: item.role,
            specialPrice: item.specialPrice || null,
            sortOrder: item.sortOrder,
          });
        }
      }

      return promo;
    }),

  /**
   * Atualiza uma promoção (admin).
   */
  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        code: z
          .string()
          .min(1)
          .max(50)
          .transform((v) => v.toUpperCase().trim())
          .optional(),
        description: z.string().max(500).optional(),
        type: z
          .enum([
            "PERCENTAGE",
            "FIXED_AMOUNT",
            "FREE_DELIVERY",
            "COMBO",
            "BUY_X_GET_Y",
          ])
          .optional(),
        value: z.string().optional(),
        bundlePrice: z.string().nullable().optional(),
        daysOfWeek: z.array(z.number().int().min(0).max(6)).nullable().optional(),
        timeStart: z.string().max(5).nullable().optional(),
        timeEnd: z.string().max(5).nullable().optional(),
        imageUrl: z.string().nullable().optional(),
        maxChoices: z.number().int().positive().nullable().optional(),
        minOrderValue: z.string().nullable().optional(),
        maxDiscount: z.string().nullable().optional(),
        maxUses: z.number().int().positive().nullable().optional(),
        maxUsesPerCustomer: z.number().int().positive().optional(),
        startDate: z.string().optional(),
        endDate: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
        items: z.array(promotionItemInput).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, startDate, endDate, items, ...rest } = input;

      // Se mudou o código, verificar unicidade
      if (rest.code) {
        const [existing] = await db
          .select({ id: promotions.id })
          .from(promotions)
          .where(
            and(
              eq(promotions.tenantId, ctx.tenantId),
              eq(promotions.code, rest.code)
            )
          )
          .limit(1);

        if (existing && existing.id !== id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe uma promoção com o código "${rest.code}"`,
          });
        }
      }

      const updateData: Record<string, unknown> = { ...rest };
      if (startDate !== undefined) {
        updateData.startDate = new Date(startDate);
      }
      if (endDate !== undefined) {
        updateData.endDate = endDate ? new Date(endDate) : null;
      }

      const [updated] = await db
        .update(promotions)
        .set(updateData)
        .where(
          and(eq(promotions.id, id), eq(promotions.tenantId, ctx.tenantId))
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Promoção não encontrada",
        });
      }

      // Se enviou itens, recria (delete + insert)
      if (items !== undefined) {
        await db
          .delete(promotionItems)
          .where(eq(promotionItems.promotionId, id));

        if (items.length > 0) {
          for (const item of items) {
            await db.insert(promotionItems).values({
              promotionId: id,
              productId: item.productId || null,
              categoryId: item.categoryId || null,
              quantity: item.quantity,
              role: item.role,
              specialPrice: item.specialPrice || null,
              sortOrder: item.sortOrder,
            });
          }
        }
      }

      return updated;
    }),

  /**
   * Exclui uma promoção (admin).
   */
  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await getDb()
        .delete(promotions)
        .where(
          and(
            eq(promotions.id, input.id),
            eq(promotions.tenantId, ctx.tenantId)
          )
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Promoção não encontrada",
        });
      }

      return { success: true };
    }),

  /**
   * Valida um código de promoção (público - usado no checkout do cliente).
   * Retorna detalhes do desconto se válido.
   */
  validate: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        code: z
          .string()
          .min(1)
          .transform((v) => v.toUpperCase().trim()),
        subtotal: z.number().positive(),
        deliveryFee: z.number().min(0).default(0),
        customerPhone: z.string().optional(),
        /** IDs dos produtos no carrinho (para validar combos) */
        cartProductIds: z
          .array(
            z.object({
              productId: z.string().uuid(),
              categoryId: z.string().uuid().optional(),
              quantity: z.number().int().min(1),
            })
          )
          .optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();

      // Buscar promoção
      const [promo] = await db
        .select()
        .from(promotions)
        .where(
          and(
            eq(promotions.tenantId, input.tenantId),
            eq(promotions.code, input.code),
            eq(promotions.isActive, true)
          )
        )
        .limit(1);

      if (!promo) {
        return { valid: false as const, error: "Código de promoção inválido" };
      }

      // Verificar datas
      const now = new Date();
      if (promo.startDate && now < promo.startDate) {
        return {
          valid: false as const,
          error: "Esta promoção ainda não começou",
        };
      }
      if (promo.endDate && now > promo.endDate) {
        return { valid: false as const, error: "Esta promoção já expirou" };
      }

      // Verificar dia da semana
      if (promo.daysOfWeek && (promo.daysOfWeek as number[]).length > 0) {
        const currentDay = now.getDay(); // 0=Dom, 1=Seg, etc
        if (!(promo.daysOfWeek as number[]).includes(currentDay)) {
          const validDays = (promo.daysOfWeek as number[])
            .map((d) => DAY_NAMES[d])
            .join(", ");
          return {
            valid: false as const,
            error: `Esta promoção é válida apenas: ${validDays}`,
          };
        }
      }

      // Verificar horário
      if (promo.timeStart && promo.timeEnd) {
        const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        if (currentTime < promo.timeStart || currentTime > promo.timeEnd) {
          return {
            valid: false as const,
            error: `Esta promoção é válida das ${promo.timeStart} às ${promo.timeEnd}`,
          };
        }
      }

      // Verificar valor mínimo do pedido
      if (
        promo.minOrderValue &&
        input.subtotal < parseFloat(promo.minOrderValue)
      ) {
        return {
          valid: false as const,
          error: `Pedido mínimo de R$ ${parseFloat(promo.minOrderValue).toFixed(2)} para esta promoção`,
        };
      }

      // Verificar limite total de usos
      if (promo.maxUses) {
        const [usageCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(promotionUsage)
          .where(eq(promotionUsage.promotionId, promo.id));

        if ((usageCount?.count ?? 0) >= promo.maxUses) {
          return {
            valid: false as const,
            error: "Esta promoção esgotou o limite de usos",
          };
        }
      }

      // Verificar limite de usos por cliente
      if (input.customerPhone && promo.maxUsesPerCustomer) {
        const [customerUsage] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(promotionUsage)
          .where(
            and(
              eq(promotionUsage.promotionId, promo.id),
              eq(promotionUsage.customerPhone, input.customerPhone)
            )
          );

        if ((customerUsage?.count ?? 0) >= promo.maxUsesPerCustomer) {
          return {
            valid: false as const,
            error: "Você já usou esta promoção o número máximo de vezes",
          };
        }
      }

      // Calcular desconto
      let discountAmount = 0;

      switch (promo.type) {
        case "PERCENTAGE": {
          discountAmount = input.subtotal * (parseFloat(promo.value) / 100);
          if (promo.maxDiscount) {
            discountAmount = Math.min(
              discountAmount,
              parseFloat(promo.maxDiscount)
            );
          }
          break;
        }
        case "FIXED_AMOUNT": {
          discountAmount = Math.min(parseFloat(promo.value), input.subtotal);
          break;
        }
        case "FREE_DELIVERY": {
          discountAmount = input.deliveryFee;
          break;
        }
        case "COMBO": {
          // Para combos, o desconto é: subtotal dos itens - bundlePrice
          if (promo.bundlePrice) {
            // Verificar se o carrinho contém os itens do combo
            const comboItems = await db
              .select()
              .from(promotionItems)
              .where(eq(promotionItems.promotionId, promo.id));

            if (input.cartProductIds) {
              const allItemsPresent = comboItems.every((comboItem) => {
                if (comboItem.productId) {
                  const cartItem = input.cartProductIds!.find(
                    (c) => c.productId === comboItem.productId
                  );
                  return cartItem && cartItem.quantity >= comboItem.quantity;
                }
                if (comboItem.categoryId) {
                  const categoryItems = input.cartProductIds!.filter(
                    (c) => c.categoryId === comboItem.categoryId
                  );
                  const totalQty = categoryItems.reduce(
                    (s, c) => s + c.quantity,
                    0
                  );
                  return totalQty >= comboItem.quantity;
                }
                return true;
              });

              if (!allItemsPresent) {
                return {
                  valid: false as const,
                  error:
                    "Seu carrinho não contém todos os itens necessários para este combo",
                };
              }
            }

            discountAmount = Math.max(
              0,
              input.subtotal - parseFloat(promo.bundlePrice)
            );
          }
          break;
        }
        case "BUY_X_GET_Y": {
          // Item grátis: o desconto é o valor do item FREE
          const freeItems = await db
            .select({
              productId: promotionItems.productId,
              specialPrice: promotionItems.specialPrice,
            })
            .from(promotionItems)
            .where(
              and(
                eq(promotionItems.promotionId, promo.id),
                eq(promotionItems.role, "FREE")
              )
            );

          if (freeItems.length > 0) {
            // Buscar preço dos produtos grátis
            for (const freeItem of freeItems) {
              if (freeItem.productId) {
                const [product] = await db
                  .select({ price: products.price })
                  .from(products)
                  .where(eq(products.id, freeItem.productId))
                  .limit(1);
                if (product) {
                  discountAmount += parseFloat(product.price);
                }
              }
            }
          } else {
            // Fallback para valor fixo
            discountAmount = parseFloat(promo.value);
          }
          break;
        }
      }

      discountAmount = Math.round(discountAmount * 100) / 100;

      return {
        valid: true as const,
        promotionId: promo.id,
        code: promo.code,
        type: promo.type,
        description: promo.description,
        discountAmount,
        bundlePrice: promo.bundlePrice,
      };
    }),

  /**
   * Lista promoções ativas do tenant (público - para banners no cardápio).
   */
  listPublic: publicProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = getDb();
      const now = new Date();

      const promoList = await db
        .select({
          id: promotions.id,
          code: promotions.code,
          description: promotions.description,
          type: promotions.type,
          value: promotions.value,
          bundlePrice: promotions.bundlePrice,
          daysOfWeek: promotions.daysOfWeek,
          timeStart: promotions.timeStart,
          timeEnd: promotions.timeEnd,
          imageUrl: promotions.imageUrl,
          maxChoices: promotions.maxChoices,
          minOrderValue: promotions.minOrderValue,
        })
        .from(promotions)
        .where(
          and(
            eq(promotions.tenantId, input.tenantId),
            eq(promotions.isActive, true),
            sql`${promotions.startDate} <= ${now}`,
            sql`(${promotions.endDate} IS NULL OR ${promotions.endDate} >= ${now})`
          )
        );

      // Buscar itens para combos
      const withItems = await Promise.all(
        promoList.map(async (promo) => {
          if (promo.type !== "COMBO" && promo.type !== "BUY_X_GET_Y") {
            return { ...promo, items: [] };
          }

          const items = await db
            .select({
              productId: promotionItems.productId,
              categoryId: promotionItems.categoryId,
              quantity: promotionItems.quantity,
              role: promotionItems.role,
              productName: products.name,
              categoryName: categories.name,
            })
            .from(promotionItems)
            .leftJoin(products, eq(promotionItems.productId, products.id))
            .leftJoin(categories, eq(promotionItems.categoryId, categories.id))
            .where(eq(promotionItems.promotionId, promo.id))
            .orderBy(asc(promotionItems.sortOrder));

          return { ...promo, items };
        })
      );

      return withItems;
    }),
});
