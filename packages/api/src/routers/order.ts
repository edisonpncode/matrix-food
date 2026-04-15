import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, tenantProcedure } from "../trpc";
import {
  getDb,
  orders,
  orderItems,
  orderItemCustomizations,
  orderItemIngredients,
  products,
  productVariants,
  productIngredients,
  ingredients,
  customizationOptions,
  cashRegisterSessions,
  cashRegisterTransactions,
  deliveryPersonEarnings,
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
  gte,
  lte,
} from "@matrix-food/database";
import { generateOrderNumber, pointInPolygon } from "@matrix-food/utils";
import { tryAutoEmitNfce } from "../services/fiscal/auto-emit";

// --- Schemas de validação ---

const orderItemCustomizationInput = z.object({
  customizationGroupName: z.string().min(1),
  customizationOptionName: z.string().min(1),
  optionId: z.string().uuid(), // para buscar preço real no servidor
});

const orderItemIngredientInput = z.object({
  ingredientId: z.string().uuid(),
  /** Para QUANTITY: quantidade escolhida pelo cliente */
  quantity: z.number().int().min(0).optional(),
  /** Para DESCRIPTION: estado escolhido (SEM/COM/MENOS/MAIS) */
  state: z.enum(["SEM", "COM", "MENOS", "MAIS"]).optional(),
});

const orderItemInput = z.object({
  productId: z.string().uuid(),
  productVariantId: z.string().uuid().nullable(),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
  customizations: z.array(orderItemCustomizationInput).default([]),
  ingredients: z.array(orderItemIngredientInput).default([]),
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

// --- Helper: auto-salvar cliente ao criar pedido ---

interface DeliveryAddressForCustomer {
  street: string;
  number: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  referencePoint?: string;
}

async function ensureCustomerFromOrder(params: {
  db: ReturnType<typeof getDb>;
  tenantId: string;
  customerName: string;
  customerPhone: string;
  cpf?: string;
  deliveryAddress?: DeliveryAddressForCustomer | null;
  source?: string;
}): Promise<string | null> {
  const { db, tenantId, customerName, customerPhone, cpf, deliveryAddress, source } = params;

  // Sem telefone = sem cadastro automático
  const cleanPhone = customerPhone?.trim();
  if (!cleanPhone || cleanPhone.length < 8) return null;

  const cleanName = customerName?.trim();
  if (!cleanName) return null;

  // Buscar cliente existente por telefone
  const [existing] = await db
    .select()
    .from(customers)
    .where(eq(customers.phone, cleanPhone))
    .limit(1);

  if (existing) {
    // Atualizar nome se diferente e não-vazio
    const updates: Record<string, unknown> = {};
    if (cleanName && cleanName !== existing.name && cleanName !== "Balcão") {
      updates.name = cleanName;
    }
    // Atualizar CPF se o existente não tem e novo foi fornecido
    if (cpf && !existing.cpf) {
      updates.cpf = cpf;
    }

    // Adicionar endereço se for delivery e não duplicado
    if (deliveryAddress && deliveryAddress.street) {
      const currentAddresses = (existing.addresses as Array<Record<string, unknown>>) || [];
      const isDuplicate = currentAddresses.some(
        (a) =>
          String(a.street || "").toLowerCase().trim() === deliveryAddress.street.toLowerCase().trim() &&
          String(a.number || "").trim() === deliveryAddress.number.trim()
      );
      if (!isDuplicate) {
        const newAddr = {
          label: `Endereço ${currentAddresses.length + 1}`,
          street: deliveryAddress.street,
          number: deliveryAddress.number,
          complement: deliveryAddress.complement || "",
          neighborhood: deliveryAddress.neighborhood || "",
          city: deliveryAddress.city || "",
          state: deliveryAddress.state || "",
          zipCode: deliveryAddress.zipCode || "",
          referencePoint: deliveryAddress.referencePoint || "",
        };
        updates.addresses = [...currentAddresses, newAddr];
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(customers).set(updates).where(eq(customers.id, existing.id));
    }

    // Garantir vínculo com o tenant
    const [existingTenant] = await db
      .select()
      .from(customerTenants)
      .where(
        and(
          eq(customerTenants.customerId, existing.id),
          eq(customerTenants.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existingTenant) {
      await db.insert(customerTenants).values({
        customerId: existing.id,
        tenantId,
      });
    }

    return existing.id;
  }

  // Criar novo cliente
  const addresses = deliveryAddress && deliveryAddress.street
    ? [
        {
          label: "Endereço 1",
          street: deliveryAddress.street,
          number: deliveryAddress.number,
          complement: deliveryAddress.complement || "",
          neighborhood: deliveryAddress.neighborhood || "",
          city: deliveryAddress.city || "",
          state: deliveryAddress.state || "",
          zipCode: deliveryAddress.zipCode || "",
          referencePoint: deliveryAddress.referencePoint || "",
        },
      ]
    : [];

  const [created] = await db
    .insert(customers)
    .values({
      name: cleanName,
      phone: cleanPhone,
      cpf: cpf ?? null,
      email: null,
      source: source ?? null,
      addresses,
    })
    .returning();

  if (!created) return null;

  // Criar vínculo com o tenant
  await db.insert(customerTenants).values({
    customerId: created.id,
    tenantId,
  });

  return created.id;
}

/**
 * Computa a modificação de um ingrediente para a comanda.
 * Retorna null se não houve modificação (manteve o padrão).
 */
function computeIngredientModification(params: {
  ingredientType: "QUANTITY" | "DESCRIPTION";
  ingredientName: string;
  defaultQuantity: number;
  defaultState: string;
  additionalPrice: number;
  chosenQuantity?: number;
  chosenState?: string;
}): { modification: string; price: number; quantity: number } | null {
  if (params.ingredientType === "QUANTITY") {
    const chosen = params.chosenQuantity ?? params.defaultQuantity;
    if (chosen === params.defaultQuantity) return null;
    if (chosen === 0) {
      return { modification: `SEM ${params.ingredientName}`, price: 0, quantity: 0 };
    }
    if (chosen > params.defaultQuantity) {
      const diff = chosen - params.defaultQuantity;
      return {
        modification: `+${diff} ${params.ingredientName}`,
        price: diff * params.additionalPrice,
        quantity: chosen,
      };
    }
    // Redução parcial (não zero)
    const diff = params.defaultQuantity - chosen;
    return { modification: `-${diff} ${params.ingredientName}`, price: 0, quantity: chosen };
  }

  // DESCRIPTION type
  const chosen = params.chosenState ?? params.defaultState;
  if (chosen === params.defaultState) return null;

  let price = 0;
  if (chosen === "MAIS") price = params.additionalPrice;
  if (chosen === "COM" && params.defaultState === "SEM") price = params.additionalPrice;

  return {
    modification: `${chosen} ${params.ingredientName}`,
    price,
    quantity: 0,
  };
}

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
        /** Se o cliente estiver logado, passa o customerId — evita re-criar por telefone. */
        customerId: z.string().uuid().optional(),
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

          // Calcular preço dos ingredientes
          let ingredientsTotal = 0;
          const resolvedIngredients: Array<{
            ingredientName: string;
            modification: string;
            quantity: number;
            price: string;
          }> = [];

          if (item.ingredients.length > 0) {
            // Buscar configuração dos ingredientes deste produto
            const prodIngs = await db
              .select({
                ingredientId: productIngredients.ingredientId,
                defaultQuantity: productIngredients.defaultQuantity,
                defaultState: productIngredients.defaultState,
                additionalPrice: productIngredients.additionalPrice,
                ingredientName: ingredients.name,
                ingredientType: ingredients.type,
              })
              .from(productIngredients)
              .innerJoin(
                ingredients,
                eq(productIngredients.ingredientId, ingredients.id)
              )
              .where(eq(productIngredients.productId, product.id));

            const ingMap = new Map(prodIngs.map((pi) => [pi.ingredientId, pi]));

            for (const ingInput of item.ingredients) {
              const config = ingMap.get(ingInput.ingredientId);
              if (!config) continue;

              const mod = computeIngredientModification({
                ingredientType: config.ingredientType,
                ingredientName: config.ingredientName,
                defaultQuantity: config.defaultQuantity,
                defaultState: config.defaultState,
                additionalPrice: parseFloat(config.additionalPrice),
                chosenQuantity: ingInput.quantity,
                chosenState: ingInput.state,
              });

              if (mod) {
                ingredientsTotal += mod.price;
                resolvedIngredients.push({
                  ingredientName: config.ingredientName,
                  modification: mod.modification,
                  quantity: mod.quantity,
                  price: mod.price.toFixed(2),
                });
              }
            }
          }

          const itemUnitPrice =
            parseFloat(unitPrice) + customizationsTotal + ingredientsTotal;
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
            ingredientModifications: resolvedIngredients,
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

      // Resolver cliente: se logado (customerId passado), apenas garante
      // o vínculo cross-tenant; senão, faz o fluxo antigo por telefone.
      let resolvedCustomerId: string | null = null;
      if (input.customerId) {
        const [existing] = await db
          .select({
            id: customers.id,
            addresses: customers.addresses,
          })
          .from(customers)
          .where(eq(customers.id, input.customerId))
          .limit(1);

        if (existing) {
          resolvedCustomerId = existing.id;

          // Garante vínculo com o tenant (cross-tenant automático).
          const [existingLink] = await db
            .select({ customerId: customerTenants.customerId })
            .from(customerTenants)
            .where(
              and(
                eq(customerTenants.customerId, existing.id),
                eq(customerTenants.tenantId, input.tenantId)
              )
            )
            .limit(1);
          if (!existingLink) {
            await db
              .insert(customerTenants)
              .values({ customerId: existing.id, tenantId: input.tenantId })
              .onConflictDoNothing();
          }

          // Se for delivery e o endereço não existe no perfil, adiciona.
          if (input.deliveryAddress && input.deliveryAddress.street) {
            const currentAddresses =
              (existing.addresses as Array<{
                label: string;
                street: string;
                number: string;
                complement?: string;
                neighborhood: string;
                city: string;
                state: string;
                zipCode: string;
                referencePoint?: string;
                lat?: number;
                lng?: number;
              }>) || [];
            const isDuplicate = currentAddresses.some(
              (a) =>
                a.street.toLowerCase().trim() ===
                  input.deliveryAddress!.street.toLowerCase().trim() &&
                a.number.trim() === input.deliveryAddress!.number.trim()
            );
            if (!isDuplicate) {
              const newAddr = {
                label: `Endereço ${currentAddresses.length + 1}`,
                street: input.deliveryAddress.street,
                number: input.deliveryAddress.number,
                complement: input.deliveryAddress.complement || "",
                neighborhood: input.deliveryAddress.neighborhood || "",
                city: input.deliveryAddress.city || "",
                state: input.deliveryAddress.state || "",
                zipCode: input.deliveryAddress.zipCode || "",
                referencePoint: input.deliveryAddress.referencePoint || "",
              };
              await db
                .update(customers)
                .set({ addresses: [...currentAddresses, newAddr] })
                .where(eq(customers.id, existing.id));
            }
          }
        }
      }

      if (!resolvedCustomerId) {
        // Fallback: cria/reutiliza cliente por telefone (fluxo antigo).
        resolvedCustomerId = await ensureCustomerFromOrder({
          db,
          tenantId: input.tenantId,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          deliveryAddress: input.deliveryAddress,
          source: "ONLINE",
        });
      }

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
          customerId: resolvedCustomerId ?? null,
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

        // 8b. Criar modificações de ingredientes do item
        if (item.ingredientModifications.length > 0) {
          await db.insert(orderItemIngredients).values(
            item.ingredientModifications.map((ing) => ({
              orderItemId: orderItem.id,
              ...ing,
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

      // 12. Atualizar stats do cliente
      if (resolvedCustomerId) {
        const [existingCt] = await db
          .select()
          .from(customerTenants)
          .where(
            and(
              eq(customerTenants.customerId, resolvedCustomerId),
              eq(customerTenants.tenantId, input.tenantId)
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

      const itemsWithDetails = await Promise.all(
        items.map(async (item) => {
          const customizations = await db
            .select()
            .from(orderItemCustomizations)
            .where(eq(orderItemCustomizations.orderItemId, item.id));
          const ingredientMods = await db
            .select()
            .from(orderItemIngredients)
            .where(eq(orderItemIngredients.orderItemId, item.id));
          return { ...item, customizations, ingredientModifications: ingredientMods };
        })
      );

      return { ...order, items: itemsWithDetails };
    }),

  /**
   * Lista pedidos do restaurante (admin).
   */
  listByTenant: tenantProcedure
    .input(
      z.object({
        /** Um único status (legado) OU array de status (novos filtros). */
        status: z
          .union([
            z.enum([
              "PENDING",
              "CONFIRMED",
              "PREPARING",
              "READY",
              "OUT_FOR_DELIVERY",
              "DELIVERED",
              "PICKED_UP",
              "CANCELLED",
            ]),
            z.array(
              z.enum([
                "PENDING",
                "CONFIRMED",
                "PREPARING",
                "READY",
                "OUT_FOR_DELIVERY",
                "DELIVERED",
                "PICKED_UP",
                "CANCELLED",
              ])
            ),
          ])
          .optional(),
        /** Excluir status específicos (ex: "Ativos" = tudo exceto DELIVERED/CANCELLED/PICKED_UP). */
        statusNotIn: z
          .array(
            z.enum([
              "PENDING",
              "CONFIRMED",
              "PREPARING",
              "READY",
              "OUT_FOR_DELIVERY",
              "DELIVERED",
              "PICKED_UP",
              "CANCELLED",
            ])
          )
          .optional(),
        /** Filtra por origem do pedido (ONLINE x POS). */
        source: z.enum(["ONLINE", "POS", "PHONE"]).optional(),
        /** Filtra por tipo (DELIVERY, PICKUP, COUNTER, TABLE, DINE_IN). */
        type: z
          .union([
            z.enum(["DELIVERY", "PICKUP", "DINE_IN", "COUNTER", "TABLE"]),
            z.array(
              z.enum(["DELIVERY", "PICKUP", "DINE_IN", "COUNTER", "TABLE"])
            ),
          ])
          .optional(),
        /** Filtra por status de pagamento (útil p/ "Finalizados"). */
        paymentStatus: z.enum(["PENDING", "PAID", "REFUNDED"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conditions = [eq(orders.tenantId, ctx.tenantId)];

      if (input.status) {
        if (Array.isArray(input.status)) {
          if (input.status.length > 0) {
            conditions.push(inArray(orders.status, input.status));
          }
        } else {
          conditions.push(eq(orders.status, input.status));
        }
      }

      if (input.statusNotIn && input.statusNotIn.length > 0) {
        conditions.push(not(inArray(orders.status, input.statusNotIn)));
      }

      if (input.source) {
        conditions.push(eq(orders.source, input.source));
      }

      if (input.type) {
        if (Array.isArray(input.type)) {
          if (input.type.length > 0) {
            conditions.push(inArray(orders.type, input.type));
          }
        } else {
          conditions.push(eq(orders.type, input.type));
        }
      }

      if (input.paymentStatus) {
        conditions.push(eq(orders.paymentStatus, input.paymentStatus));
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
        cpf: z.string().max(14).optional(),
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

          // Calcular preço dos ingredientes
          let ingredientsTotal = 0;
          const resolvedIngredients: Array<{
            ingredientName: string;
            modification: string;
            quantity: number;
            price: string;
          }> = [];

          if (item.ingredients.length > 0) {
            const prodIngs = await db
              .select({
                ingredientId: productIngredients.ingredientId,
                defaultQuantity: productIngredients.defaultQuantity,
                defaultState: productIngredients.defaultState,
                additionalPrice: productIngredients.additionalPrice,
                ingredientName: ingredients.name,
                ingredientType: ingredients.type,
              })
              .from(productIngredients)
              .innerJoin(
                ingredients,
                eq(productIngredients.ingredientId, ingredients.id)
              )
              .where(eq(productIngredients.productId, product.id));

            const ingMap = new Map(prodIngs.map((pi) => [pi.ingredientId, pi]));

            for (const ingInput of item.ingredients) {
              const config = ingMap.get(ingInput.ingredientId);
              if (!config) continue;

              const mod = computeIngredientModification({
                ingredientType: config.ingredientType,
                ingredientName: config.ingredientName,
                defaultQuantity: config.defaultQuantity,
                defaultState: config.defaultState,
                additionalPrice: parseFloat(config.additionalPrice),
                chosenQuantity: ingInput.quantity,
                chosenState: ingInput.state,
              });

              if (mod) {
                ingredientsTotal += mod.price;
                resolvedIngredients.push({
                  ingredientName: config.ingredientName,
                  modification: mod.modification,
                  quantity: mod.quantity,
                  price: mod.price.toFixed(2),
                });
              }
            }
          }

          const itemUnitPrice = parseFloat(unitPrice) + customizationsTotal + ingredientsTotal;
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
            ingredientModifications: resolvedIngredients,
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

      // Determinar status e paymentStatus por tipo de pedido.
      // Pedidos criados pelo POS nunca passam por "Pendentes" — só ONLINE passa.
      // Todos os tipos começam em PREPARING para o operador ver direto na cozinha.
      const orderStatus = "PREPARING" as const;
      let paymentStatus: "PENDING" | "PAID" = "PENDING";

      switch (input.type) {
        case "COUNTER":
        case "DINE_IN":
          // Consumo imediato: normalmente já pago na hora.
          paymentStatus = "PAID";
          break;
        case "TABLE":
          if (!input.tableNumber) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Número da mesa é obrigatório para pedidos tipo TABLE",
            });
          }
          // Mesa: paga no fechamento da comanda.
          paymentStatus = "PENDING";
          break;
        case "PICKUP":
        case "DELIVERY":
          // Retirada/entrega: paga na conferência final (finalizeDelivery / finalizeOrder).
          paymentStatus = "PENDING";
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

      // Auto-salvar cliente (se telefone fornecido)
      const resolvedCustomerId = input.customerId
        ?? await ensureCustomerFromOrder({
             db,
             tenantId: ctx.tenantId,
             customerName: input.customerName,
             customerPhone: input.customerPhone,
             cpf: input.cpf,
             deliveryAddress: input.deliveryAddress,
             source: "POS",
           });

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
          customerId: resolvedCustomerId ?? null,
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

        // Inserir modificações de ingredientes
        if (item.ingredientModifications.length > 0) {
          await db.insert(orderItemIngredients).values(
            item.ingredientModifications.map((ing) => ({
              orderItemId: orderItem.id,
              ...ing,
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

      // Atualizar stats do cliente
      if (resolvedCustomerId) {
        const [existingCt] = await db
          .select()
          .from(customerTenants)
          .where(
            and(
              eq(customerTenants.customerId, resolvedCustomerId),
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

      // Emissão automática de NFC-e (fire-and-forget)
      if (paymentStatus === "PAID") {
        tryAutoEmitNfce(ctx.tenantId, order.id).catch(() => {});
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

      // Emissão automática de NFC-e para cada pedido da mesa
      for (const o of openOrders) {
        tryAutoEmitNfce(ctx.tenantId, o.id).catch(() => {});
      }

      return {
        closedOrders: openOrders.length,
        total: tableTotal.toFixed(2),
      };
    }),

  /**
   * Aprova um pedido ONLINE pendente, movendo para PREPARING.
   * (Elimina o passo fantasma "CONFIRMED" do fluxo antigo.)
   */
  approveOnlineOrder: tenantProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

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

      if (existingOrder.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Só é possível aprovar pedidos que estão em 'Pendentes'.",
        });
      }

      const [updated] = await db
        .update(orders)
        .set({ status: "PREPARING" })
        .where(eq(orders.id, input.orderId))
        .returning();

      return updated;
    }),

  /**
   * Atribui um entregador a um pedido.
   * Também registra uma COMMISSION no saldo do motoboy (valor = deliveryFee do pedido).
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

      if (existingOrder.type !== "DELIVERY") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Só é possível atribuir motoboy para pedidos de entrega.",
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

      // Sessão de caixa aberta (opcional) para carimbar o earning
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

      // Atualizar pedido
      const [updated] = await db
        .update(orders)
        .set({
          deliveryPersonId: input.deliveryPersonId,
          status: "OUT_FOR_DELIVERY",
        })
        .where(eq(orders.id, input.orderId))
        .returning();

      // Registrar comissão do motoboy (= deliveryFee do pedido).
      // Se deliveryFee for 0, registra mesmo assim com valor 0 — mantém o rastro da entrega.
      const commissionAmount = existingOrder.deliveryFee ?? "0";
      await db.insert(deliveryPersonEarnings).values({
        tenantId: ctx.tenantId,
        deliveryPersonId: input.deliveryPersonId,
        orderId: existingOrder.id,
        sessionId: activeSession?.id ?? null,
        type: "COMMISSION",
        amount: commissionAmount,
        description: `Comissão pedido #${existingOrder.displayNumber}`,
        createdBy: ctx.user.name ?? ctx.user.email ?? "Sistema",
      });

      return updated;
    }),

  /**
   * Finaliza uma entrega (DELIVERY em OUT_FOR_DELIVERY).
   * Faz a conferência do valor recebido pelo motoboy e trata prejuízo/sobra.
   */
  finalizeDelivery: tenantProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        amountReceived: z.number().nonnegative(),
        shortageHandling: z
          .enum(["DISCOUNT_DRIVER", "ACCEPT_LOSS"])
          .optional(),
        surplusHandling: z.enum(["ADD_DRIVER", "ADD_CASH"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

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

      if (existingOrder.type !== "DELIVERY") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "finalizeDelivery só pode ser usado em pedidos de entrega.",
        });
      }

      if (existingOrder.status !== "OUT_FOR_DELIVERY") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "O pedido precisa estar no estágio 'Entregando' para ser finalizado.",
        });
      }

      if (!existingOrder.deliveryPersonId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Este pedido não tem motoboy atribuído.",
        });
      }

      const total = parseFloat(existingOrder.total);
      const received = input.amountReceived;
      // arredonda diff para 2 casas p/ evitar falsos prejuízos/sobras por ponto flutuante
      const diffRaw = received - total;
      const diff = Math.round(diffRaw * 100) / 100;

      // Validação dos handlings
      if (diff < 0 && !input.shortageHandling) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Valor recebido é menor que o total. Informe como tratar (shortageHandling).",
        });
      }
      if (diff > 0 && !input.surplusHandling) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Valor recebido excede o total. Informe como tratar (surplusHandling).",
        });
      }

      // Sessão de caixa aberta (se houver)
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

      const operator = ctx.user.name ?? ctx.user.email ?? "Funcionário";
      const displayNumber = existingOrder.displayNumber;
      const deliveryPersonId = existingOrder.deliveryPersonId;

      // === Aplicar lógica de diferença ===
      if (diff < 0) {
        // Faltou dinheiro
        if (input.shortageHandling === "DISCOUNT_DRIVER") {
          // Lê saldo ATUAL do motoboy (antes de aplicar). Motoboy absorve até o saldo;
          // o excesso vira prejuízo do caixa (transparente na UI).
          const [balanceRow] = await db
            .select({
              balance: sql<string>`COALESCE(SUM(${deliveryPersonEarnings.amount}), '0')`,
            })
            .from(deliveryPersonEarnings)
            .where(
              and(
                eq(deliveryPersonEarnings.tenantId, ctx.tenantId),
                eq(
                  deliveryPersonEarnings.deliveryPersonId,
                  deliveryPersonId
                )
              )
            );
          const balance = parseFloat(balanceRow?.balance ?? "0");
          const shortfall = Math.abs(diff); // positivo
          // Motoboy absorve o mínimo entre seu saldo positivo e o total faltante.
          const driverShare =
            balance > 0 ? Math.min(balance, shortfall) : 0;
          const cashShare =
            Math.round((shortfall - driverShare) * 100) / 100;

          if (driverShare > 0) {
            await db.insert(deliveryPersonEarnings).values({
              tenantId: ctx.tenantId,
              deliveryPersonId,
              orderId: existingOrder.id,
              sessionId: activeSession?.id ?? null,
              type: "SHORTAGE_DEDUCTION",
              amount: (-driverShare).toFixed(2),
              description: `Desconto troco a menor pedido #${displayNumber}`,
              createdBy: operator,
            });
          }

          if (cashShare > 0 && activeSession) {
            await db.insert(cashRegisterTransactions).values({
              sessionId: activeSession.id,
              tenantId: ctx.tenantId,
              type: "ADJUSTMENT",
              amount: (-cashShare).toFixed(2),
              description:
                driverShare > 0
                  ? `Prejuízo entrega #${displayNumber} (saldo motoboy insuficiente)`
                  : `Prejuízo entrega #${displayNumber} (motoboy sem saldo)`,
              orderId: existingOrder.id,
              createdBy: operator,
            });
          }
        } else {
          // ACCEPT_LOSS: prejuízo direto do caixa, sem mexer no motoboy
          if (activeSession) {
            await db.insert(cashRegisterTransactions).values({
              sessionId: activeSession.id,
              tenantId: ctx.tenantId,
              type: "ADJUSTMENT",
              amount: diff.toFixed(2), // negativo
              description: `Prejuízo entrega #${displayNumber}`,
              orderId: existingOrder.id,
              createdBy: operator,
            });
          }
        }
      } else if (diff > 0) {
        // Sobrou dinheiro
        if (input.surplusHandling === "ADD_DRIVER") {
          await db.insert(deliveryPersonEarnings).values({
            tenantId: ctx.tenantId,
            deliveryPersonId,
            orderId: existingOrder.id,
            sessionId: activeSession?.id ?? null,
            type: "SURPLUS_BONUS",
            amount: diff.toFixed(2),
            description: `Sobra troco pedido #${displayNumber}`,
            createdBy: operator,
          });
        } else {
          // ADD_CASH
          if (activeSession) {
            await db.insert(cashRegisterTransactions).values({
              sessionId: activeSession.id,
              tenantId: ctx.tenantId,
              type: "ADJUSTMENT",
              amount: diff.toFixed(2), // positivo
              description: `Sobra entrega #${displayNumber}`,
              orderId: existingOrder.id,
              createdBy: operator,
            });
          }
        }
      }

      // Atualiza o pedido
      const [updated] = await db
        .update(orders)
        .set({
          status: "DELIVERED",
          paymentStatus: "PAID",
          amountReceived: received.toFixed(2),
          shortageHandling: diff < 0 ? input.shortageHandling ?? null : null,
          surplusHandling: diff > 0 ? input.surplusHandling ?? null : null,
        })
        .where(eq(orders.id, input.orderId))
        .returning();

      // Auto-emissão NFC-e em background
      tryAutoEmitNfce(ctx.tenantId, existingOrder.id).catch(() => {});

      return updated;
    }),

  /**
   * Finaliza um pedido que NÃO é DELIVERY (PICKUP, COUNTER, TABLE, DINE_IN).
   * Sem motoboy, sem modal de diferença — só registra recebimento e fecha.
   */
  finalizeOrder: tenantProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        amountReceived: z.number().nonnegative().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

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

      if (existingOrder.type === "DELIVERY") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Para pedidos de entrega, use finalizeDelivery (precisa da conferência de valor).",
        });
      }

      if (
        existingOrder.status === "DELIVERED" ||
        existingOrder.status === "PICKED_UP" ||
        existingOrder.status === "CANCELLED"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pedido já finalizado ou cancelado.",
        });
      }

      const finalStatus =
        existingOrder.type === "PICKUP" ? "PICKED_UP" : "DELIVERED";

      const [updated] = await db
        .update(orders)
        .set({
          status: finalStatus,
          paymentStatus: "PAID",
          amountReceived: input.amountReceived?.toFixed(2) ?? null,
        })
        .where(eq(orders.id, input.orderId))
        .returning();

      // Se já existe sessão aberta e paymentStatus mudou p/ PAID,
      // registrar venda no caixa se ainda não tiver sido registrada.
      if (existingOrder.paymentStatus !== "PAID") {
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
          // Evita duplicar venda já lançada por createFromPOS
          const [existingSale] = await db
            .select()
            .from(cashRegisterTransactions)
            .where(
              and(
                eq(cashRegisterTransactions.orderId, existingOrder.id),
                eq(cashRegisterTransactions.type, "SALE")
              )
            )
            .limit(1);

          if (!existingSale) {
            await db.insert(cashRegisterTransactions).values({
              sessionId: activeSession.id,
              tenantId: ctx.tenantId,
              type: "SALE",
              amount: existingOrder.total,
              description: `Pedido #${existingOrder.displayNumber}`,
              orderId: existingOrder.id,
              createdBy: ctx.user.name ?? ctx.user.email ?? "Funcionário",
            });
          }
        }
      }

      tryAutoEmitNfce(ctx.tenantId, existingOrder.id).catch(() => {});

      return updated;
    }),

  /**
   * Saldo/agregados de cada motoboy no período.
   * Default: últimos 30 dias (operador filtra por sessão/dia na UI).
   */
  getDeliveryPersonBalances: tenantProcedure
    .input(
      z
        .object({
          from: z.date().optional(),
          to: z.date().optional(),
          deliveryPersonId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const from =
        input?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = input?.to ?? new Date();

      const conditions = [
        eq(deliveryPersonEarnings.tenantId, ctx.tenantId),
        gte(deliveryPersonEarnings.createdAt, from),
        lte(deliveryPersonEarnings.createdAt, to),
      ];
      if (input?.deliveryPersonId) {
        conditions.push(
          eq(deliveryPersonEarnings.deliveryPersonId, input.deliveryPersonId)
        );
      }

      // Agrega por motoboy
      const rows = await db
        .select({
          deliveryPersonId: deliveryPersonEarnings.deliveryPersonId,
          totalCommission: sql<string>`COALESCE(SUM(CASE WHEN ${deliveryPersonEarnings.type} = 'COMMISSION' THEN ${deliveryPersonEarnings.amount} ELSE 0 END), '0')`,
          totalShortage: sql<string>`COALESCE(SUM(CASE WHEN ${deliveryPersonEarnings.type} = 'SHORTAGE_DEDUCTION' THEN ${deliveryPersonEarnings.amount} ELSE 0 END), '0')`,
          totalSurplus: sql<string>`COALESCE(SUM(CASE WHEN ${deliveryPersonEarnings.type} = 'SURPLUS_BONUS' THEN ${deliveryPersonEarnings.amount} ELSE 0 END), '0')`,
          totalPayout: sql<string>`COALESCE(SUM(CASE WHEN ${deliveryPersonEarnings.type} = 'PAYOUT' THEN ${deliveryPersonEarnings.amount} ELSE 0 END), '0')`,
          balance: sql<string>`COALESCE(SUM(${deliveryPersonEarnings.amount}), '0')`,
          orderCount: sql<number>`COUNT(DISTINCT CASE WHEN ${deliveryPersonEarnings.type} = 'COMMISSION' THEN ${deliveryPersonEarnings.orderId} END)::int`,
        })
        .from(deliveryPersonEarnings)
        .where(and(...conditions))
        .groupBy(deliveryPersonEarnings.deliveryPersonId);

      // Junta com nomes dos motoboys
      const people = await db
        .select({
          id: tenantUsers.id,
          name: tenantUsers.name,
          isActive: tenantUsers.isActive,
        })
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.tenantId, ctx.tenantId),
            eq(tenantUsers.role, "DELIVERY")
          )
        );

      const rowMap = new Map(rows.map((r) => [r.deliveryPersonId, r]));

      return people.map((p) => {
        const r = rowMap.get(p.id);
        return {
          deliveryPersonId: p.id,
          name: p.name,
          isActive: p.isActive,
          totalCommission: r?.totalCommission ?? "0",
          totalShortage: r?.totalShortage ?? "0",
          totalSurplus: r?.totalSurplus ?? "0",
          totalPayout: r?.totalPayout ?? "0",
          balance: r?.balance ?? "0",
          orderCount: r?.orderCount ?? 0,
        };
      });
    }),

  /**
   * Registra acerto (pagamento) ao motoboy, zerando ou reduzindo o saldo.
   * Cria um PAYOUT (amount negativo) e uma WITHDRAWAL no caixa (se houver sessão aberta).
   */
  registerDriverPayout: tenantProcedure
    .input(
      z.object({
        deliveryPersonId: z.string().uuid(),
        amount: z.number().positive(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [deliveryPerson] = await db
        .select()
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.id, input.deliveryPersonId),
            eq(tenantUsers.tenantId, ctx.tenantId),
            eq(tenantUsers.role, "DELIVERY")
          )
        )
        .limit(1);

      if (!deliveryPerson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Motoboy não encontrado.",
        });
      }

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

      const operator = ctx.user.name ?? ctx.user.email ?? "Funcionário";
      const amountNeg = (-input.amount).toFixed(2);

      await db.insert(deliveryPersonEarnings).values({
        tenantId: ctx.tenantId,
        deliveryPersonId: input.deliveryPersonId,
        sessionId: activeSession?.id ?? null,
        type: "PAYOUT",
        amount: amountNeg,
        description:
          input.notes ?? `Acerto motoboy ${deliveryPerson.name}`,
        createdBy: operator,
      });

      if (activeSession) {
        await db.insert(cashRegisterTransactions).values({
          sessionId: activeSession.id,
          tenantId: ctx.tenantId,
          type: "WITHDRAWAL",
          amount: input.amount.toFixed(2),
          description: `Acerto motoboy ${deliveryPerson.name}`,
          createdBy: operator,
        });
      }

      return { ok: true };
    }),
});
