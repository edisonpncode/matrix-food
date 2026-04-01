import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, tenantProcedure } from "../trpc";
import {
  getDb,
  orders,
  orderItems,
  orderItemCustomizations,
  products,
  productVariants,
  customizationOptions,
  cashRegisterSessions,
  cashRegisterTransactions,
  promotions,
  promotionUsage,
  loyaltyConfig,
  loyaltyTransactions,
  deliveryAreas,
  customers,
  customerTenants,
  tenantUsers,
  eq,
  and,
  not,
  inArray,
  desc,
  sql,
} from "@matrix-food/database";
import { generateOrderNumber, pointInPolygon } from "@matrix-food/utils";

// --- Schemas de validação ---

const orderItemCustomizationInput = z.object({
  customizationGroupName: z.string().min(1),
  customizationOptionName: z.string().min(1),
  optionId: z.string().uuid(), // para buscar preço real no servidor
});

const orderItemInput = z.object({
  productId: z.string().uuid(),
  productVariantId: z.string().uuid().nullable(),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
  customizations: z.array(orderItemCustomizationInput).default([]),
});

const deliveryAddressInput = z.object({
  street: z.string().min(1),
  number: z.string().min(1),
  complement: z.string().optional(),
  neighborhood: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().max(2).optional().default(""),
  zipCode: z.string().optional().default(""),
  referencePoint: z.string().optional(),
});

export const orderRouter = createTRPCRouter({
  /**
   * Cria um novo pedido (público - clientes não logados).
   * Preços são calculados server-side para segurança.
   */
  create: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        type: z.enum(["DELIVERY", "PICKUP", "DINE_IN", "COUNTER", "TABLE"]),
        customerName: z.string().min(1).max(255),
        customerPhone: z.string().min(1).max(20),
        deliveryAddress: deliveryAddressInput.nullable(),
        deliveryAreaId: z.string().uuid().optional(),
        paymentMethod: z.enum(["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD"]),
        changeFor: z.string().nullable().optional(),
        notes: z.string().optional(),
        promoCode: z.string().optional(),
        loyaltyRewardDiscount: z.number().optional(),
        items: z.array(orderItemInput).min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // 1. Calcular preços server-side para cada item
      const itemsWithPrices = await Promise.all(
        input.items.map(async (item) => {
          // Buscar produto
          const [product] = await db
            .select()
            .from(products)
            .where(
              and(
                eq(products.id, item.productId),
                eq(products.tenantId, input.tenantId),
                eq(products.isActive, true)
              )
            )
            .limit(1);

          if (!product) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Produto não encontrado: ${item.productId}`,
            });
          }

          // Determinar preço unitário
          let unitPrice = product.price;
          let variantName: string | null = null;

          if (item.productVariantId) {
            const [variant] = await db
              .select()
              .from(productVariants)
              .where(
                and(
                  eq(productVariants.id, item.productVariantId),
                  eq(productVariants.productId, product.id),
                  eq(productVariants.isActive, true)
                )
              )
              .limit(1);

            if (!variant) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Variante não encontrada: ${item.productVariantId}`,
              });
            }

            unitPrice = variant.price;
            variantName = variant.name;
          }

          // Calcular preço das personalizações
          let customizationsTotal = 0;
          const resolvedCustomizations = await Promise.all(
            item.customizations.map(async (c) => {
              const [option] = await db
                .select()
                .from(customizationOptions)
                .where(eq(customizationOptions.id, c.optionId))
                .limit(1);

              const optionPrice = option ? parseFloat(option.price) : 0;
              customizationsTotal += optionPrice;

              return {
                customizationGroupName: c.customizationGroupName,
                customizationOptionName: c.customizationOptionName,
                price: option?.price ?? "0",
              };
            })
          );

          const itemUnitPrice =
            parseFloat(unitPrice) + customizationsTotal;
          const totalPrice = itemUnitPrice * item.quantity;

          return {
            productId: product.id,
            productVariantId: item.productVariantId,
            productName: product.name,
            variantName,
            unitPrice: itemUnitPrice.toFixed(2),
            quantity: item.quantity,
            totalPrice: totalPrice.toFixed(2),
            notes: item.notes,
            customizations: resolvedCustomizations,
          };
        })
      );

      // 2. Calcular subtotal
      const subtotal = itemsWithPrices.reduce(
        (sum, item) => sum + parseFloat(item.totalPrice),
        0
      );

      // 3. Taxa de entrega (calculada a partir da área de entrega)
      let deliveryFee = 0;
      if (input.type === "DELIVERY" && input.deliveryAreaId) {
        const [area] = await db
          .select()
          .from(deliveryAreas)
          .where(
            and(
              eq(deliveryAreas.id, input.deliveryAreaId),
              eq(deliveryAreas.tenantId, input.tenantId),
              eq(deliveryAreas.isActive, true)
            )
          )
          .limit(1);

        if (area) {
          deliveryFee = parseFloat(area.deliveryFee);
          // Frete grátis acima de X
          if (area.freeDeliveryAbove && subtotal >= parseFloat(area.freeDeliveryAbove)) {
            deliveryFee = 0;
          }
        }
      }

      // 4. Validar e calcular desconto de promoção
      let discount = 0;
      let promotionId: string | null = null;

      if (input.promoCode) {
        const [promo] = await db
          .select()
          .from(promotions)
          .where(
            and(
              eq(promotions.tenantId, input.tenantId),
              eq(promotions.code, input.promoCode.toUpperCase().trim()),
              eq(promotions.isActive, true)
            )
          )
          .limit(1);

        if (promo) {
          const now = new Date();
          const isValid =
            (!promo.startDate || now >= promo.startDate) &&
            (!promo.endDate || now <= promo.endDate) &&
            (!promo.minOrderValue || subtotal >= parseFloat(promo.minOrderValue));

          if (isValid) {
            // Verificar limites de uso
            let withinLimits = true;

            if (promo.maxUses) {
              const [usageCount] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(promotionUsage)
                .where(eq(promotionUsage.promotionId, promo.id));
              if ((usageCount?.count ?? 0) >= promo.maxUses) withinLimits = false;
            }

            if (withinLimits && input.customerPhone && promo.maxUsesPerCustomer) {
              const [customerUsage] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(promotionUsage)
                .where(
                  and(
                    eq(promotionUsage.promotionId, promo.id),
                    eq(promotionUsage.customerPhone, input.customerPhone)
                  )
                );
              if ((customerUsage?.count ?? 0) >= promo.maxUsesPerCustomer) withinLimits = false;
            }

            if (withinLimits) {
              promotionId = promo.id;
              switch (promo.type) {
                case "PERCENTAGE":
                  discount = subtotal * (parseFloat(promo.value) / 100);
                  if (promo.maxDiscount) discount = Math.min(discount, parseFloat(promo.maxDiscount));
                  break;
                case "FIXED_AMOUNT":
                  discount = Math.min(parseFloat(promo.value), subtotal);
                  break;
                case "FREE_DELIVERY":
                  discount = deliveryFee;
                  break;
              }
              discount = Math.round(discount * 100) / 100;
            }
          }
        }
      }

      // 5. Desconto de fidelidade
      const loyaltyDiscount = input.loyaltyRewardDiscount
        ? Math.min(input.loyaltyRewardDiscount, subtotal - discount)
        : 0;

      // 6. Total
      const total = subtotal + deliveryFee - discount - loyaltyDiscount;

      // 7. Calcular pontos de fidelidade a ganhar
      let loyaltyPointsEarned = 0;
      const [loyaltyConf] = await db
        .select()
        .from(loyaltyConfig)
        .where(
          and(
            eq(loyaltyConfig.tenantId, input.tenantId),
            eq(loyaltyConfig.isActive, true)
          )
        )
        .limit(1);

      if (loyaltyConf && input.customerPhone) {
        const minOrder = loyaltyConf.minOrderForPoints
          ? parseFloat(loyaltyConf.minOrderForPoints)
          : 0;
        if (total >= minOrder) {
          loyaltyPointsEarned = Math.floor(
            total * parseFloat(loyaltyConf.pointsPerReal)
          );
        }
      }

      // 8. Gerar número do pedido (sequencial por tenant)
      const [lastOrder] = await db
        .select({ orderNumber: orders.orderNumber })
        .from(orders)
        .where(eq(orders.tenantId, input.tenantId))
        .orderBy(desc(orders.orderNumber))
        .limit(1);

      const nextOrderNumber = (lastOrder?.orderNumber ?? 0) + 1;
      const displayNumber = generateOrderNumber(nextOrderNumber);

      // 9. Criar pedido + itens em transação
      const [order] = await db
        .insert(orders)
        .values({
          tenantId: input.tenantId,
          orderNumber: nextOrderNumber,
          displayNumber,
          type: input.type,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          deliveryAddress: input.deliveryAddress,
          deliveryAreaId: input.deliveryAreaId ?? null,
          subtotal: subtotal.toFixed(2),
          deliveryFee: deliveryFee.toFixed(2),
          discount: discount.toFixed(2),
          total: total.toFixed(2),
          paymentMethod: input.paymentMethod,
          changeFor: input.changeFor,
          notes: input.notes,
          promotionId,
          loyaltyPointsEarned,
          loyaltyDiscount: loyaltyDiscount.toFixed(2),
        })
        .returning();

      if (!order) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar pedido",
        });
      }

      // 7. Criar itens do pedido
      for (const item of itemsWithPrices) {
        const [orderItem] = await db
          .insert(orderItems)
          .values({
            orderId: order.id,
            productId: item.productId,
            productVariantId: item.productVariantId,
            productName: item.productName,
            variantName: item.variantName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            notes: item.notes,
          })
          .returning();

        if (!orderItem) continue;

        // 8. Criar personalizações do item
        if (item.customizations.length > 0) {
          await db.insert(orderItemCustomizations).values(
            item.customizations.map((c) => ({
              orderItemId: orderItem.id,
              ...c,
            }))
          );
        }
      }

      // 10. Registrar uso da promoção
      if (promotionId && order) {
        await db.insert(promotionUsage).values({
          promotionId,
          orderId: order.id,
          tenantId: input.tenantId,
          customerPhone: input.customerPhone || null,
          discountAmount: discount.toFixed(2),
        });
      }

      // 11. Creditar pontos de fidelidade
      if (loyaltyPointsEarned > 0 && input.customerPhone && order) {
        await db.insert(loyaltyTransactions).values({
          tenantId: input.tenantId,
          customerPhone: input.customerPhone,
          type: "EARNED",
          points: loyaltyPointsEarned,
          description: `Pedido ${displayNumber}`,
          orderId: order.id,
        });
      }

      return {
        id: order.id,
        displayNumber: order.displayNumber,
        total: order.total,
        status: order.status,
        loyaltyPointsEarned,
      };
    }),

  /**
   * Busca pedido por ID (público - cliente pode ver seu pedido).
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = getDb();

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.id))
        .limit(1);

      if (!order) return null;

      // Buscar itens com personalizações
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      const itemsWithCustomizations = await Promise.all(
        items.map(async (item) => {
          const customizations = await db
            .select()
            .from(orderItemCustomizations)
            .where(eq(orderItemCustomizations.orderItemId, item.id));
          return { ...item, customizations };
        })
      );

      return { ...order, items: itemsWithCustomizations };
    }),

  /**
   * Lista pedidos do restaurante (admin).
   */
  listByTenant: tenantProcedure
    .input(
      z.object({
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
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conditions = [eq(orders.tenantId, ctx.tenantId)];

      if (input.status) {
        conditions.push(eq(orders.status, input.status));
      }

      const orderList = await db
        .select()
        .from(orders)
        .where(and(...conditions))
        .orderBy(desc(orders.createdAt));

      // Buscar itens para cada pedido
      const ordersWithItems = await Promise.all(
        orderList.map(async (order) => {
          const items = await db
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, order.id));
          return { ...order, items };
        })
      );

      return ordersWithItems;
    }),

  /**
   * Atualiza status do pedido (admin).
   */
  updateStatus: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum([
          "PENDING",
          "CONFIRMED",
          "PREPARING",
          "READY",
          "OUT_FOR_DELIVERY",
          "DELIVERED",
          "PICKED_UP",
          "CANCELLED",
        ]),
        deliveryPersonId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = { status: input.status };

      // Se status é OUT_FOR_DELIVERY e deliveryPersonId fornecido, atribuir entregador
      if (input.status === "OUT_FOR_DELIVERY" && input.deliveryPersonId) {
        updateData.deliveryPersonId = input.deliveryPersonId;
      }

      const [updated] = await getDb()
        .update(orders)
        .set(updateData)
        .where(
          and(eq(orders.id, input.id), eq(orders.tenantId, ctx.tenantId))
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido não encontrado",
        });
      }

      return updated;
    }),

  /**
   * Cria pedido pelo POS (funcionário). Source = POS.
   * Registra venda no caixa automaticamente se houver sessão aberta.
   */
  createFromPOS: tenantProcedure
    .input(
      z.object({
        type: z.enum(["DELIVERY", "PICKUP", "DINE_IN", "COUNTER", "TABLE"]),
        tableNumber: z.number().int().min(1).optional(),
        customerId: z.string().uuid().optional(),
        customerName: z.string().default("Balcão"),
        customerPhone: z.string().default(""),
        deliveryAddress: deliveryAddressInput.nullable().optional(),
        deliveryAreaId: z.string().uuid().optional(),
        manualDeliveryFee: z.string().optional(),
        paymentMethod: z.enum(["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD"]).optional().default("CASH"),
        changeFor: z.string().nullable().optional(),
        notes: z.string().optional(),
        promoCode: z.string().optional(),
        items: z.array(orderItemInput).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Calcular preços server-side (mesma lógica do create)
      const itemsWithPrices = await Promise.all(
        input.items.map(async (item) => {
          const [product] = await db
            .select()
            .from(products)
            .where(
              and(
                eq(products.id, item.productId),
                eq(products.tenantId, ctx.tenantId),
                eq(products.isActive, true)
              )
            )
            .limit(1);

          if (!product) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Produto não encontrado: ${item.productId}`,
            });
          }

          let unitPrice = product.price;
          let variantName: string | null = null;

          if (item.productVariantId) {
            const [variant] = await db
              .select()
              .from(productVariants)
              .where(
                and(
                  eq(productVariants.id, item.productVariantId),
                  eq(productVariants.productId, product.id),
                  eq(productVariants.isActive, true)
                )
              )
              .limit(1);

            if (!variant) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Variante não encontrada: ${item.productVariantId}`,
              });
            }

            unitPrice = variant.price;
            variantName = variant.name;
          }

          let customizationsTotal = 0;
          const resolvedCustomizations = await Promise.all(
            item.customizations.map(async (c) => {
              const [option] = await db
                .select()
                .from(customizationOptions)
                .where(eq(customizationOptions.id, c.optionId))
                .limit(1);

              const optionPrice = option ? parseFloat(option.price) : 0;
              customizationsTotal += optionPrice;

              return {
                customizationGroupName: c.customizationGroupName,
                customizationOptionName: c.customizationOptionName,
                price: option?.price ?? "0",
              };
            })
          );

          const itemUnitPrice = parseFloat(unitPrice) + customizationsTotal;
          const totalPrice = itemUnitPrice * item.quantity;

          return {
            productId: product.id,
            productVariantId: item.productVariantId,
            productName: product.name,
            variantName,
            unitPrice: itemUnitPrice.toFixed(2),
            quantity: item.quantity,
            totalPrice: totalPrice.toFixed(2),
            notes: item.notes,
            customizations: resolvedCustomizations,
          };
        })
      );

      const subtotal = itemsWithPrices.reduce(
        (sum, item) => sum + parseFloat(item.totalPrice),
        0
      );

      // Calcular taxa de entrega (para DELIVERY)
      let deliveryFee = 0;
      if (input.type === "DELIVERY") {
        if (input.deliveryAreaId) {
          const [area] = await db
            .select()
            .from(deliveryAreas)
            .where(
              and(
                eq(deliveryAreas.id, input.deliveryAreaId),
                eq(deliveryAreas.tenantId, ctx.tenantId),
                eq(deliveryAreas.isActive, true)
              )
            )
            .limit(1);

          if (area) {
            deliveryFee = parseFloat(area.deliveryFee);
            // Frete grátis acima de X
            if (area.freeDeliveryAbove && subtotal >= parseFloat(area.freeDeliveryAbove)) {
              deliveryFee = 0;
            }
          }
        } else if (input.manualDeliveryFee) {
          deliveryFee = parseFloat(input.manualDeliveryFee);
        }
      }

      // Validar promoção (se houver código)
      let discount = 0;
      let promotionId: string | null = null;

      if (input.promoCode) {
        const [promo] = await db
          .select()
          .from(promotions)
          .where(
            and(
              eq(promotions.tenantId, ctx.tenantId),
              eq(promotions.code, input.promoCode.toUpperCase().trim()),
              eq(promotions.isActive, true)
            )
          )
          .limit(1);

        if (promo) {
          const now = new Date();
          const isValid =
            (!promo.startDate || now >= promo.startDate) &&
            (!promo.endDate || now <= promo.endDate) &&
            (!promo.minOrderValue || subtotal >= parseFloat(promo.minOrderValue));

          if (isValid) {
            promotionId = promo.id;
            switch (promo.type) {
              case "PERCENTAGE":
                discount = subtotal * (parseFloat(promo.value) / 100);
                if (promo.maxDiscount) discount = Math.min(discount, parseFloat(promo.maxDiscount));
                break;
              case "FIXED_AMOUNT":
                discount = Math.min(parseFloat(promo.value), subtotal);
                break;
              case "FREE_DELIVERY":
                discount = deliveryFee;
                break;
            }
            discount = Math.round(discount * 100) / 100;
          }
        }
      }

      const total = subtotal + deliveryFee - discount;

      // Determinar status e paymentStatus por tipo de pedido
      let orderStatus: "PENDING" | "CONFIRMED" = "PENDING";
      let paymentStatus: "PENDING" | "PAID" = "PAID";

      switch (input.type) {
        case "COUNTER":
        case "DINE_IN":
          orderStatus = "CONFIRMED";
          paymentStatus = "PAID";
          break;
        case "TABLE":
          if (!input.tableNumber) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Número da mesa é obrigatório para pedidos tipo TABLE",
            });
          }
          orderStatus = "CONFIRMED";
          paymentStatus = "PENDING";
          break;
        case "PICKUP":
        case "DELIVERY":
          orderStatus = "PENDING";
          paymentStatus = "PAID";
          break;
      }

      // Calcular pontos de fidelidade
      let loyaltyPointsEarned = 0;
      const [loyaltyConf] = await db
        .select()
        .from(loyaltyConfig)
        .where(
          and(
            eq(loyaltyConfig.tenantId, ctx.tenantId),
            eq(loyaltyConfig.isActive, true)
          )
        )
        .limit(1);

      if (loyaltyConf && input.customerPhone) {
        const minOrder = loyaltyConf.minOrderForPoints
          ? parseFloat(loyaltyConf.minOrderForPoints)
          : 0;
        if (total >= minOrder) {
          loyaltyPointsEarned = Math.floor(
            total * parseFloat(loyaltyConf.pointsPerReal)
          );
        }
      }

      // Gerar número do pedido
      const [lastOrder] = await db
        .select({ orderNumber: orders.orderNumber })
        .from(orders)
        .where(eq(orders.tenantId, ctx.tenantId))
        .orderBy(desc(orders.orderNumber))
        .limit(1);

      const nextOrderNumber = (lastOrder?.orderNumber ?? 0) + 1;
      const displayNumber = generateOrderNumber(nextOrderNumber);

      // Criar pedido com source POS
      const [order] = await db
        .insert(orders)
        .values({
          tenantId: ctx.tenantId,
          orderNumber: nextOrderNumber,
          displayNumber,
          type: input.type,
          source: "POS",
          status: orderStatus,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerId: input.customerId ?? null,
          tableNumber: input.tableNumber ?? null,
          deliveryPersonId: null,
          deliveryAreaId: input.deliveryAreaId ?? null,
          deliveryAddress: input.deliveryAddress ?? null,
          subtotal: subtotal.toFixed(2),
          deliveryFee: deliveryFee.toFixed(2),
          discount: discount.toFixed(2),
          total: total.toFixed(2),
          paymentMethod: input.paymentMethod,
          paymentStatus,
          changeFor: input.changeFor,
          notes: input.notes,
          promotionId,
          loyaltyPointsEarned,
        })
        .returning();

      if (!order) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar pedido",
        });
      }

      // Criar itens do pedido
      for (const item of itemsWithPrices) {
        const [orderItem] = await db
          .insert(orderItems)
          .values({
            orderId: order.id,
            productId: item.productId,
            productVariantId: item.productVariantId,
            productName: item.productName,
            variantName: item.variantName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            notes: item.notes,
          })
          .returning();

        if (!orderItem) continue;

        if (item.customizations.length > 0) {
          await db.insert(orderItemCustomizations).values(
            item.customizations.map((c) => ({
              orderItemId: orderItem.id,
              ...c,
            }))
          );
        }
      }

      // Registrar uso da promoção
      if (promotionId && order) {
        await db.insert(promotionUsage).values({
          promotionId,
          orderId: order.id,
          tenantId: ctx.tenantId,
          customerPhone: input.customerPhone || null,
          discountAmount: discount.toFixed(2),
        });
      }

      // Creditar pontos de fidelidade
      if (loyaltyPointsEarned > 0 && input.customerPhone && order) {
        await db.insert(loyaltyTransactions).values({
          tenantId: ctx.tenantId,
          customerPhone: input.customerPhone,
          type: "EARNED",
          points: loyaltyPointsEarned,
          description: `Pedido ${displayNumber}`,
          orderId: order.id,
        });
      }

      // Atualizar stats do cliente (se customerId fornecido)
      if (input.customerId) {
        const [existingCt] = await db
          .select()
          .from(customerTenants)
          .where(
            and(
              eq(customerTenants.customerId, input.customerId),
              eq(customerTenants.tenantId, ctx.tenantId)
            )
          )
          .limit(1);

        if (existingCt) {
          await db
            .update(customerTenants)
            .set({
              totalOrders: sql`${customerTenants.totalOrders} + 1`,
              totalSpent: sql`${customerTenants.totalSpent} + ${total.toFixed(2)}::decimal`,
              lastOrderAt: new Date(),
              ...(existingCt.firstOrderAt ? {} : { firstOrderAt: new Date() }),
            })
            .where(eq(customerTenants.id, existingCt.id));
        }
      }

      // Registrar venda no caixa automaticamente (se sessão aberta)
      const [activeSession] = await db
        .select()
        .from(cashRegisterSessions)
        .where(
          and(
            eq(cashRegisterSessions.tenantId, ctx.tenantId),
            eq(cashRegisterSessions.status, "OPEN")
          )
        )
        .limit(1);

      if (activeSession) {
        await db.insert(cashRegisterTransactions).values({
          sessionId: activeSession.id,
          tenantId: ctx.tenantId,
          type: "SALE",
          amount: total.toFixed(2),
          description: `Pedido ${displayNumber}`,
          orderId: order.id,
          createdBy: ctx.user.name ?? ctx.user.email ?? "Funcionário",
        });
      }

      return {
        id: order.id,
        displayNumber: order.displayNumber,
        total: order.total,
        status: order.status,
        loyaltyPointsEarned,
      };
    }),

  /**
   * Lista mesas abertas com pedidos ativos.
   */
  listOpenTables: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();

    const result = await db.execute<{
      tableNumber: number;
      orderCount: number;
      totalValue: string;
      openedAt: Date;
    }>(sql`
      SELECT
        table_number as "tableNumber",
        count(*)::int as "orderCount",
        sum(total)::decimal as "totalValue",
        min(created_at) as "openedAt"
      FROM orders
      WHERE tenant_id = ${ctx.tenantId}
        AND type = 'TABLE'
        AND status NOT IN ('DELIVERED', 'CANCELLED', 'PICKED_UP')
        AND table_number IS NOT NULL
      GROUP BY table_number
      ORDER BY table_number
    `);

    return result as Array<{
      tableNumber: number;
      orderCount: number;
      totalValue: string;
      openedAt: Date;
    }>;
  }),

  /**
   * Lista pedidos de uma mesa específica.
   */
  getTableOrders: tenantProcedure
    .input(z.object({ tableNumber: z.number().int().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const tableOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            eq(orders.tableNumber, input.tableNumber),
            eq(orders.type, "TABLE"),
            not(inArray(orders.status, ["DELIVERED", "CANCELLED", "PICKED_UP"]))
          )
        )
        .orderBy(desc(orders.createdAt));

      // Buscar itens para cada pedido
      const ordersWithItems = await Promise.all(
        tableOrders.map(async (order) => {
          const items = await db
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, order.id));
          return { ...order, items };
        })
      );

      return ordersWithItems;
    }),

  /**
   * Fecha uma mesa: marca todos os pedidos como entregues/pagos.
   */
  closeTable: tenantProcedure
    .input(
      z.object({
        tableNumber: z.number().int().min(1),
        paymentMethod: z.enum(["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Buscar pedidos abertos da mesa
      const openOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, ctx.tenantId),
            eq(orders.tableNumber, input.tableNumber),
            eq(orders.type, "TABLE"),
            not(inArray(orders.status, ["DELIVERED", "CANCELLED", "PICKED_UP"]))
          )
        );

      if (openOrders.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nenhum pedido aberto encontrado para esta mesa",
        });
      }

      // Atualizar todos os pedidos
      const orderIds = openOrders.map((o) => o.id);
      await db
        .update(orders)
        .set({
          status: "DELIVERED",
          paymentStatus: "PAID",
          paymentMethod: input.paymentMethod,
        })
        .where(inArray(orders.id, orderIds));

      // Calcular total de todos os pedidos da mesa
      const tableTotal = openOrders.reduce(
        (sum, o) => sum + parseFloat(o.total),
        0
      );

      // Registrar venda no caixa automaticamente (se sessão aberta)
      const [activeSession] = await db
        .select()
        .from(cashRegisterSessions)
        .where(
          and(
            eq(cashRegisterSessions.tenantId, ctx.tenantId),
            eq(cashRegisterSessions.status, "OPEN")
          )
        )
        .limit(1);

      if (activeSession) {
        await db.insert(cashRegisterTransactions).values({
          sessionId: activeSession.id,
          tenantId: ctx.tenantId,
          type: "SALE",
          amount: tableTotal.toFixed(2),
          description: `Mesa ${input.tableNumber} (${openOrders.length} pedido${openOrders.length > 1 ? "s" : ""})`,
          createdBy: ctx.user.name ?? ctx.user.email ?? "Funcionário",
        });
      }

      return {
        closedOrders: openOrders.length,
        total: tableTotal.toFixed(2),
      };
    }),

  /**
   * Atribui um entregador a um pedido.
   */
  assignDeliveryPerson: tenantProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        deliveryPersonId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verificar se o pedido pertence ao tenant
      const [existingOrder] = await db
        .select()
        .from(orders)
        .where(
          and(eq(orders.id, input.orderId), eq(orders.tenantId, ctx.tenantId))
        )
        .limit(1);

      if (!existingOrder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido não encontrado",
        });
      }

      // Verificar se o entregador existe e tem role DELIVERY
      const [deliveryPerson] = await db
        .select()
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.id, input.deliveryPersonId),
            eq(tenantUsers.tenantId, ctx.tenantId),
            eq(tenantUsers.role, "DELIVERY"),
            eq(tenantUsers.isActive, true)
          )
        )
        .limit(1);

      if (!deliveryPerson) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Entregador não encontrado ou não tem permissão de entrega",
        });
      }

      // Atualizar pedido
      const [updated] = await db
        .update(orders)
        .set({
          deliveryPersonId: input.deliveryPersonId,
          status: "OUT_FOR_DELIVERY",
        })
        .where(eq(orders.id, input.orderId))
        .returning();

      return updated;
    }),
});
