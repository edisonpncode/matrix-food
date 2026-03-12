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
  eq,
  and,
  desc,
  sql,
} from "@matrix-food/database";
import { generateOrderNumber } from "@matrix-food/utils";

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
  neighborhood: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1).max(2),
  zipCode: z.string().min(1),
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
        type: z.enum(["DELIVERY", "PICKUP", "DINE_IN"]),
        customerName: z.string().min(1).max(255),
        customerPhone: z.string().min(1).max(20),
        deliveryAddress: deliveryAddressInput.nullable(),
        paymentMethod: z.enum(["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD"]),
        changeFor: z.string().nullable().optional(),
        notes: z.string().optional(),
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

      // 3. Taxa de entrega (TODO: pegar das configurações do tenant)
      const deliveryFee = input.type === "DELIVERY" ? 0 : 0;

      // 4. Total
      const total = subtotal + deliveryFee;

      // 5. Gerar número do pedido (sequencial por tenant)
      const [lastOrder] = await db
        .select({ orderNumber: orders.orderNumber })
        .from(orders)
        .where(eq(orders.tenantId, input.tenantId))
        .orderBy(desc(orders.orderNumber))
        .limit(1);

      const nextOrderNumber = (lastOrder?.orderNumber ?? 0) + 1;
      const displayNumber = generateOrderNumber(nextOrderNumber);

      // 6. Criar pedido + itens em transação
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
          subtotal: subtotal.toFixed(2),
          deliveryFee: deliveryFee.toFixed(2),
          total: total.toFixed(2),
          paymentMethod: input.paymentMethod,
          changeFor: input.changeFor,
          notes: input.notes,
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

      return {
        id: order.id,
        displayNumber: order.displayNumber,
        total: order.total,
        status: order.status,
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await getDb()
        .update(orders)
        .set({ status: input.status })
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
});
