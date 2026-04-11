import { tool } from "ai";
import { z } from "zod";
import {
  getDb,
  categories,
  products,
  orders,
  customers,
  customerTenants,
  promotions,
  ingredients,
  tenants,
  eq,
  and,
  desc,
  asc,
  ilike,
  sql,
  count,
} from "@matrix-food/database";

/**
 * Remove HTML tags e entidades de uma string.
 */
export function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const menuCategorySchema = z.object({
  name: z.string().describe("Nome da categoria"),
  description: z.string().optional().describe("Descrição da categoria"),
  products: z.array(
    z.object({
      name: z.string().describe("Nome do produto"),
      description: z.string().optional().describe("Descrição ou ingredientes"),
      price: z.string().describe("Preço decimal, ex: '29.90'"),
      originalPrice: z.string().optional().describe("Preço riscado (promoção)"),
      isNew: z.boolean().optional().describe("Tag 'novo'"),
    })
  ),
});

// ============================================
// TOOL FACTORY
// ============================================

export function createTools(tenantId: string | null) {
  const noTenant = () => ({
    error: "Restaurante não identificado. Recarregue a página.",
  });

  return {
    // ==========================================
    // LEITURA - Categorias e Produtos
    // ==========================================

    listCategories: tool({
      description:
        "Lista todas as categorias do cardápio com contagem de produtos.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!tenantId) return noTenant();
        const db = getDb();
        const cats = await db
          .select({
            id: categories.id,
            name: categories.name,
            description: categories.description,
            sortOrder: categories.sortOrder,
            isActive: categories.isActive,
            productCount: count(products.id),
          })
          .from(categories)
          .leftJoin(products, eq(products.categoryId, categories.id))
          .where(eq(categories.tenantId, tenantId))
          .groupBy(categories.id)
          .orderBy(asc(categories.sortOrder));
        return { categories: cats, total: cats.length };
      },
    }),

    listProducts: tool({
      description:
        "Lista produtos do restaurante. Pode filtrar por categoria ou buscar por nome.",
      inputSchema: z.object({
        categoryId: z
          .string()
          .uuid()
          .optional()
          .describe("Filtrar por categoria"),
        search: z
          .string()
          .optional()
          .describe("Buscar por nome do produto"),
        limit: z
          .number()
          .optional()
          .default(50)
          .describe("Limite de resultados"),
      }),
      execute: async ({ categoryId, search, limit }) => {
        if (!tenantId) return noTenant();
        const db = getDb();
        const conditions = [eq(products.tenantId, tenantId)];
        if (categoryId) conditions.push(eq(products.categoryId, categoryId));
        if (search) conditions.push(ilike(products.name, `%${search}%`));

        const prods = await db
          .select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
            originalPrice: products.originalPrice,
            isActive: products.isActive,
            isNew: products.isNew,
            categoryId: products.categoryId,
            categoryName: categories.name,
          })
          .from(products)
          .leftJoin(categories, eq(categories.id, products.categoryId))
          .where(and(...conditions))
          .orderBy(asc(products.sortOrder))
          .limit(limit);
        return { products: prods, total: prods.length };
      },
    }),

    // ==========================================
    // ESCRITA - Categorias
    // ==========================================

    createCategory: tool({
      description: "Cria uma nova categoria no cardápio.",
      inputSchema: z.object({
        name: z.string().describe("Nome da categoria"),
        description: z.string().optional().describe("Descrição"),
      }),
      execute: async ({ name, description }) => {
        if (!tenantId) return noTenant();
        const db = getDb();
        const maxSort = await db
          .select({
            max: sql<number>`COALESCE(MAX(sort_order), -1)`,
          })
          .from(categories)
          .where(eq(categories.tenantId, tenantId));
        const [created] = await db
          .insert(categories)
          .values({
            tenantId,
            name,
            description,
            sortOrder: (maxSort[0]?.max ?? -1) + 1,
            isActive: true,
          })
          .returning();
        return {
          success: true,
          category: { id: created!.id, name: created!.name },
        };
      },
    }),

    updateCategory: tool({
      description:
        "Atualiza uma categoria existente (nome, descrição, ativa/inativa).",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID da categoria"),
        name: z.string().optional().describe("Novo nome"),
        description: z.string().optional().describe("Nova descrição"),
        isActive: z.boolean().optional().describe("Ativar/desativar"),
      }),
      execute: async ({ id, ...data }) => {
        if (!tenantId) return noTenant();
        const db = getDb();
        const updates: Record<string, unknown> = {};
        if (data.name !== undefined) updates.name = data.name;
        if (data.description !== undefined)
          updates.description = data.description;
        if (data.isActive !== undefined) updates.isActive = data.isActive;
        if (Object.keys(updates).length === 0)
          return { error: "Nenhum campo para atualizar." };
        await db
          .update(categories)
          .set(updates)
          .where(
            and(eq(categories.id, id), eq(categories.tenantId, tenantId))
          );
        return { success: true, message: "Categoria atualizada." };
      },
    }),

    deleteCategory: tool({
      description: "Exclui uma categoria e todos os seus produtos.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID da categoria"),
      }),
      execute: async ({ id }) => {
        if (!tenantId) return noTenant();
        const db = getDb();
        await db
          .delete(products)
          .where(
            and(eq(products.categoryId, id), eq(products.tenantId, tenantId))
          );
        await db
          .delete(categories)
          .where(
            and(eq(categories.id, id), eq(categories.tenantId, tenantId))
          );
        return {
          success: true,
          message: "Categoria e seus produtos excluídos.",
        };
      },
    }),

    // ==========================================
    // ESCRITA - Produtos
    // ==========================================

    createProduct: tool({
      description: "Cria um novo produto em uma categoria.",
      inputSchema: z.object({
        categoryId: z.string().uuid().describe("ID da categoria"),
        name: z.string().describe("Nome do produto"),
        description: z.string().optional().describe("Descrição"),
        price: z.string().describe("Preço decimal, ex: '29.90'"),
        originalPrice: z
          .string()
          .optional()
          .describe("Preço original (promoção)"),
      }),
      execute: async ({
        categoryId,
        name,
        description,
        price,
        originalPrice,
      }) => {
        if (!tenantId) return noTenant();
        const db = getDb();
        const maxSort = await db
          .select({
            max: sql<number>`COALESCE(MAX(sort_order), -1)`,
          })
          .from(products)
          .where(
            and(
              eq(products.tenantId, tenantId),
              eq(products.categoryId, categoryId)
            )
          );
        const [created] = await db
          .insert(products)
          .values({
            tenantId,
            categoryId,
            name,
            description,
            price,
            originalPrice,
            sortOrder: (maxSort[0]?.max ?? -1) + 1,
            isActive: true,
          })
          .returning();
        return {
          success: true,
          product: { id: created!.id, name: created!.name },
        };
      },
    }),

    updateProduct: tool({
      description:
        "Atualiza produtos existentes (nome, descrição, preço, etc). Aceita vários de uma vez.",
      inputSchema: z.object({
        updates: z
          .array(
            z.object({
              id: z.string().uuid().describe("ID do produto"),
              name: z.string().optional().describe("Novo nome"),
              description: z
                .string()
                .nullable()
                .optional()
                .describe("Nova descrição (null para remover)"),
              price: z.string().optional().describe("Novo preço"),
              originalPrice: z
                .string()
                .nullable()
                .optional()
                .describe("Novo preço original"),
              isActive: z.boolean().optional().describe("Ativar/desativar"),
              isNew: z.boolean().optional().describe("Marcar como novo"),
            })
          )
          .describe("Lista de produtos para atualizar"),
      }),
      execute: async ({ updates: items }) => {
        if (!tenantId) return noTenant();
        const db = getDb();
        let updated = 0;
        for (const item of items) {
          const { id, ...data } = item;
          const updates: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(data)) {
            if (val !== undefined) updates[key] = val;
          }
          if (Object.keys(updates).length > 0) {
            await db
              .update(products)
              .set(updates)
              .where(
                and(eq(products.id, id), eq(products.tenantId, tenantId))
              );
            updated++;
          }
        }
        return {
          success: true,
          message: `${updated} produto(s) atualizado(s).`,
        };
      },
    }),

    deleteProduct: tool({
      description: "Exclui um produto do cardápio.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID do produto"),
      }),
      execute: async ({ id }) => {
        if (!tenantId) return noTenant();
        const db = getDb();
        await db
          .delete(products)
          .where(
            and(eq(products.id, id), eq(products.tenantId, tenantId))
          );
        return { success: true, message: "Produto excluído." };
      },
    }),

    // ==========================================
    // PEDIDOS
    // ==========================================

    listOrders: tool({
      description: "Lista os pedidos recentes do restaurante.",
      inputSchema: z.object({
        status: z
          .string()
          .optional()
          .describe(
            "Filtrar: PENDING, CONFIRMED, PREPARING, READY, OUT_FOR_DELIVERY, DELIVERED, CANCELLED"
          ),
        limit: z.number().optional().default(20),
      }),
      execute: async ({ status, limit }) => {
        if (!tenantId) return noTenant();
        const db = getDb();
        const conditions = [eq(orders.tenantId, tenantId)];
        if (status) conditions.push(eq(orders.status, status as never));

        const result = await db
          .select({
            id: orders.id,
            orderNumber: orders.orderNumber,
            type: orders.type,
            status: orders.status,
            customerName: orders.customerName,
            total: orders.total,
            paymentMethod: orders.paymentMethod,
            createdAt: orders.createdAt,
          })
          .from(orders)
          .where(and(...conditions))
          .orderBy(desc(orders.createdAt))
          .limit(limit);
        return { orders: result, total: result.length };
      },
    }),

    updateOrderStatus: tool({
      description: "Atualiza o status de um pedido.",
      inputSchema: z.object({
        orderId: z.string().uuid().describe("ID do pedido"),
        status: z
          .enum([
            "PENDING",
            "CONFIRMED",
            "PREPARING",
            "READY",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "CANCELLED",
          ])
          .describe("Novo status"),
      }),
      execute: async ({ orderId, status }) => {
        if (!tenantId) return noTenant();
        const db = getDb();
        await db
          .update(orders)
          .set({ status })
          .where(
            and(eq(orders.id, orderId), eq(orders.tenantId, tenantId))
          );
        return { success: true, message: `Pedido atualizado para ${status}.` };
      },
    }),

    // ==========================================
    // CLIENTES
    // ==========================================

    searchCustomers: tool({
      description:
        "Busca clientes por nome, telefone ou CPF.",
      inputSchema: z.object({
        query: z.string().describe("Termo de busca"),
        limit: z.number().optional().default(20),
      }),
      execute: async ({ query, limit }) => {
        if (!tenantId) return noTenant();
        const db = getDb();
        const result = await db
          .select({
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
            email: customers.email,
            totalOrders: customerTenants.totalOrders,
            totalSpent: customerTenants.totalSpent,
          })
          .from(customers)
          .innerJoin(
            customerTenants,
            and(
              eq(customerTenants.customerId, customers.id),
              eq(customerTenants.tenantId, tenantId)
            )
          )
          .where(
            sql`(${customers.name} ILIKE ${
              "%" + query + "%"
            } OR ${customers.phone} ILIKE ${"%" + query + "%"})`
          )
          .limit(limit);
        return { customers: result, total: result.length };
      },
    }),

    // ==========================================
    // PROMOÇÕES
    // ==========================================

    listPromotions: tool({
      description: "Lista as promoções do restaurante.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!tenantId) return noTenant();
        const db = getDb();
        const result = await db
          .select({
            id: promotions.id,
            code: promotions.code,
            description: promotions.description,
            type: promotions.type,
            value: promotions.value,
            isActive: promotions.isActive,
            startDate: promotions.startDate,
            endDate: promotions.endDate,
          })
          .from(promotions)
          .where(eq(promotions.tenantId, tenantId))
          .orderBy(desc(promotions.createdAt));
        return { promotions: result, total: result.length };
      },
    }),

    // ==========================================
    // INGREDIENTES
    // ==========================================

    listIngredients: tool({
      description: "Lista todos os ingredientes cadastrados.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!tenantId) return noTenant();
        const db = getDb();
        const result = await db
          .select({
            id: ingredients.id,
            name: ingredients.name,
            type: ingredients.type,
            isActive: ingredients.isActive,
          })
          .from(ingredients)
          .where(eq(ingredients.tenantId, tenantId))
          .orderBy(asc(ingredients.name));
        return { ingredients: result, total: result.length };
      },
    }),

    createIngredient: tool({
      description: "Cria um novo ingrediente.",
      inputSchema: z.object({
        name: z.string().describe("Nome do ingrediente"),
        type: z
          .enum(["QUANTITY", "DESCRIPTION"])
          .describe("QUANTITY (com quantidade) ou DESCRIPTION (texto)"),
      }),
      execute: async ({ name, type }) => {
        if (!tenantId) return noTenant();
        const db = getDb();
        const [created] = await db
          .insert(ingredients)
          .values({ tenantId, name, type })
          .returning();
        return {
          success: true,
          ingredient: { id: created!.id, name: created!.name },
        };
      },
    }),

    // ==========================================
    // INFO DO RESTAURANTE
    // ==========================================

    getRestaurantInfo: tool({
      description:
        "Obtém informações do restaurante (nome, endereço, telefone, etc).",
      inputSchema: z.object({}),
      execute: async () => {
        if (!tenantId) return noTenant();
        const db = getDb();
        const [t] = await db
          .select({
            id: tenants.id,
            name: tenants.name,
            slug: tenants.slug,
            description: tenants.description,
            phone: tenants.phone,
            whatsapp: tenants.whatsapp,
            email: tenants.email,
            address: tenants.address,
            city: tenants.city,
            state: tenants.state,
            operatingHours: tenants.operatingHours,
            isActive: tenants.isActive,
          })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);
        return t ?? { error: "Restaurante não encontrado." };
      },
    }),

    updateRestaurant: tool({
      description: "Atualiza informações do restaurante.",
      inputSchema: z.object({
        name: z.string().optional().describe("Nome do restaurante"),
        description: z.string().optional().describe("Descrição"),
        phone: z.string().optional().describe("Telefone"),
        whatsapp: z.string().optional().describe("WhatsApp"),
        email: z.string().optional().describe("Email"),
        address: z.string().optional().describe("Endereço"),
      }),
      execute: async (data) => {
        if (!tenantId) return noTenant();
        const db = getDb();
        const updates: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(data)) {
          if (val !== undefined) updates[key] = val;
        }
        if (Object.keys(updates).length === 0)
          return { error: "Nenhum campo para atualizar." };
        await db.update(tenants).set(updates).where(eq(tenants.id, tenantId));
        return { success: true, message: "Dados do restaurante atualizados." };
      },
    }),

    // ==========================================
    // CARDÁPIO VIA URL/IMAGEM
    // ==========================================

    fetchUrl: tool({
      description: "Busca o conteúdo de uma URL de cardápio online.",
      inputSchema: z.object({
        url: z.string().url().describe("URL para buscar"),
      }),
      execute: async ({ url }) => {
        const pedirMatch = url.match(/pedir\.delivery\/app\/([^/]+)/);
        if (pedirMatch) {
          const slug = pedirMatch[1];
          try {
            const apiRes = await fetch(
              `https://api.multipedidos.com.br/restaurant/data/v2/${slug}`,
              { signal: AbortSignal.timeout(15000) }
            );
            if (!apiRes.ok)
              return {
                error: `Erro ${apiRes.status} ao acessar pedir.delivery.`,
              };
            const data = await apiRes.json();
            const menu = data.menu;
            const info = data.info;
            const extracted: { name: string; description?: string; products: { name: string; description?: string; price: string; originalPrice?: string; isNew?: boolean }[] }[] = [];
            if (menu?.general) {
              for (const cat of menu.general) {
                const prods = (cat.products || [])
                  .filter(
                    (p: Record<string, unknown>) => p.available !== false
                  )
                  .map((p: Record<string, unknown>) => ({
                    name: stripHtml(String(p.name || "")),
                    description: p.description
                      ? stripHtml(String(p.description))
                      : undefined,
                    price: String(Number(p.price || 0).toFixed(2)),
                    originalPrice: p.oldPrice
                      ? String(Number(p.oldPrice).toFixed(2))
                      : undefined,
                    isNew: p.tag === "new",
                  }));
                if (prods.length > 0) {
                  extracted.push({
                    name: stripHtml(String(cat.name || "Sem categoria")),
                    description: cat.description
                      ? stripHtml(String(cat.description))
                      : undefined,
                    products: prods,
                  });
                }
              }
            }
            if (extracted.length > 0) {
              const totalProducts = extracted.reduce(
                (s, c) => s + c.products.length,
                0
              );
              return {
                action: "preview" as const,
                source: "pedir.delivery",
                restaurantName: info?.name || slug,
                categories: extracted,
                summary: `${extracted.length} categoria(s), ${totalProducts} produto(s)`,
              };
            }
            return { error: "Cardápio sem produtos disponíveis." };
          } catch {
            return { error: "Erro ao acessar pedir.delivery." };
          }
        }

        try {
          const res = await fetch(url, {
            headers: { "User-Agent": "MatrixFood-Neo/1.0" },
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) return { error: `Erro ${res.status} ao acessar URL.` };
          const html = await res.text();
          if (
            html.includes("<app-root>") ||
            (html.includes('id="root"') &&
              !html.includes("<h1") &&
              !html.includes("<p"))
          ) {
            return {
              error:
                "Site usa JavaScript. Envie um print/screenshot do cardápio.",
            };
          }
          const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 15000);
          return { content: text };
        } catch {
          return { error: "Erro ao acessar URL." };
        }
      },
    }),

    previewMenu: tool({
      description:
        "Mostra prévia do cardápio para confirmação antes de cadastrar.",
      inputSchema: z.object({ categories: z.array(menuCategorySchema) }),
      execute: async ({ categories: cats }) => {
        const totalProducts = cats.reduce(
          (sum, c) => sum + c.products.length,
          0
        );
        return {
          action: "preview",
          categories: cats,
          summary: `${cats.length} categoria(s), ${totalProducts} produto(s)`,
        };
      },
    }),

    importMenu: tool({
      description:
        "Cadastra categorias e produtos. Use SOMENTE após confirmação.",
      inputSchema: z.object({ categories: z.array(menuCategorySchema) }),
      execute: async ({ categories: cats }) => {
        if (!tenantId) return noTenant();
        const db = getDb();
        let cc = 0;
        let pc = 0;
        for (let i = 0; i < cats.length; i++) {
          const cat = cats[i]!;
          const [created] = await db
            .insert(categories)
            .values({
              tenantId,
              name: cat.name,
              description: cat.description,
              sortOrder: i,
              isActive: true,
            })
            .returning();
          if (!created) continue;
          cc++;
          for (let j = 0; j < cat.products.length; j++) {
            const prod = cat.products[j]!;
            await db.insert(products).values({
              tenantId,
              categoryId: created.id,
              name: prod.name,
              description: prod.description,
              price: prod.price,
              originalPrice: prod.originalPrice,
              isNew: prod.isNew ?? false,
              sortOrder: j,
              isActive: true,
            });
            pc++;
          }
        }
        return { action: "imported", categoriesCreated: cc, productsCreated: pc };
      },
    }),
  };
}
