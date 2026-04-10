import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  decimal,
  integer,
  jsonb,
  pgEnum,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================
// ENUMS
// ============================================

export const userRoleEnum = pgEnum("user_role", [
  "OWNER",
  "MANAGER",
  "CASHIER",
  "DELIVERY",
]);

export const activityActionEnum = pgEnum("activity_action", [
  "LOGIN",
  "LOGOUT",
  "ORDER_CREATED",
  "ORDER_CONFIRMED",
  "ORDER_CANCELLED",
  "ORDER_STATUS_CHANGED",
  "CASH_OPENED",
  "CASH_CLOSED",
  "CASH_WITHDRAWAL",
  "PRODUCT_CREATED",
  "PRODUCT_UPDATED",
  "PRODUCT_DELETED",
  "CATEGORY_CREATED",
  "CATEGORY_UPDATED",
  "PROMOTION_CREATED",
  "PROMOTION_UPDATED",
  "SETTINGS_UPDATED",
  "STAFF_CREATED",
  "STAFF_UPDATED",
  "STAFF_DEACTIVATED",
  "USER_TYPE_CREATED",
  "USER_TYPE_UPDATED",
  "USER_TYPE_DELETED",
  "PIN_SWITCH",
  "STAFF_LOGIN",
  "FISCAL_CONFIG_UPDATED",
  "FISCAL_DOCUMENT_EMITTED",
  "FISCAL_DOCUMENT_CANCELLED",
  "FISCAL_DOCUMENT_RETRY",
]);

export const fiscalProviderEnum = pgEnum("fiscal_provider", [
  "FOCUS_NFE",
  "WEBMANIA",
  "NUVEM_FISCAL",
  "SAFEWEB",
]);

export const fiscalDocumentStatusEnum = pgEnum("fiscal_document_status", [
  "PENDING",
  "PROCESSING",
  "AUTHORIZED",
  "REJECTED",
  "CANCELLED",
  "ERROR",
]);

export const fiscalEmissionModeEnum = pgEnum("fiscal_emission_mode", [
  "AUTOMATIC",
  "MANUAL",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "PICKED_UP",
  "CANCELLED",
]);

export const orderTypeEnum = pgEnum("order_type", [
  "DELIVERY",
  "PICKUP",
  "DINE_IN",
  "COUNTER",
  "TABLE",
]);

export const orderSourceEnum = pgEnum("order_source", [
  "ONLINE",
  "POS",
  "PHONE",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "PIX",
  "CASH",
  "CREDIT_CARD",
  "DEBIT_CARD",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "PAID",
  "REFUNDED",
]);

export const cashTransactionTypeEnum = pgEnum("cash_transaction_type", [
  "SALE",
  "WITHDRAWAL",
  "DEPOSIT",
  "ADJUSTMENT",
]);

export const cashSessionStatusEnum = pgEnum("cash_session_status", [
  "OPEN",
  "CLOSED",
]);

export const ingredientTypeEnum = pgEnum("ingredient_type", [
  "QUANTITY",
  "DESCRIPTION",
]);

export const promotionTypeEnum = pgEnum("promotion_type", [
  "PERCENTAGE",
  "FIXED_AMOUNT",
  "FREE_DELIVERY",
  "COMBO",
  "BUY_X_GET_Y",
]);

export const loyaltyTransactionTypeEnum = pgEnum("loyalty_transaction_type", [
  "EARNED",
  "REDEEMED",
  "ADJUSTMENT",
  "EXPIRED",
]);

export const billingStatusEnum = pgEnum("billing_status", [
  "PENDING",
  "PAID",
  "OVERDUE",
  "CANCELLED",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED",
]);

// ============================================
// TENANTS (Restaurantes)
// ============================================

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
    bannerUrl: text("banner_url"),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 2 }),
    zipCode: varchar("zip_code", { length: 10 }),
    phone: varchar("phone", { length: 20 }),
    whatsapp: varchar("whatsapp", { length: 20 }),
    email: varchar("email", { length: 255 }),
    operatingHours: jsonb("operating_hours").$type<
      Record<
        string,
        { open: string; close: string; isOpen: boolean }
      >
    >(),
    deliverySettings: jsonb("delivery_settings").$type<{
      minOrder: number;
      deliveryFee: number;
      maxRadius: number;
      estimatedMinutes: { min: number; max: number };
    }>(),
    /** Tipos de comida que o restaurante vende (ex: ["hamburguer", "pizza"]) */
    foodTypes: jsonb("food_types").$type<string[]>(),
    paymentMethodsAccepted: jsonb("payment_methods_accepted").$type<string[]>(),
    themeSettings: jsonb("theme_settings").$type<{
      primaryColor: string;
      secondaryColor: string;
    }>(),
    /** Configurações de impressão (impressoras, auto-print, layout do recibo) */
    printerSettings: jsonb("printer_settings").$type<{
      printers: Array<{
        id: string;
        name: string;
        paperWidth: "80mm" | "58mm";
        connectionMethod: "BROWSER" | "NETWORK";
        networkConfig?: {
          ipAddress: string;
          port: number;
        };
        isDefault: boolean;
        isActive: boolean;
      }>;
      autoPrint: {
        enabled: boolean;
        onNewOrder: boolean;
        onOrderConfirmed: boolean;
        copies: number;
      };
      receiptTypes: {
        customer: boolean;
        kitchen: boolean;
        delivery: boolean;
      };
      receiptConfig: {
        headerText: string;
        footerText: string;
        showCustomerInfo: boolean;
        showDeliveryAddress: boolean;
        showItemNotes: boolean;
        showOrderNotes: boolean;
        showPaymentMethod: boolean;
        showTimestamp: boolean;
      };
    }>(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("tenants_slug_idx").on(table.slug)]
);

// ============================================
// USER TYPES (Tipos de Usuário / Perfis de Acesso)
// ============================================

export const userTypes = pgTable(
  "user_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: varchar("description", { length: 500 }),
    /** Permissões granulares: { "dashboard.view": true, "orders.manage": true, ... } */
    permissions: jsonb("permissions")
      .notNull()
      .$type<Record<string, boolean>>()
      .default({}),
    /** Tipo do sistema (não pode ser editado/excluído) */
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("user_types_tenant_idx").on(table.tenantId)]
);

// ============================================
// TENANT USERS (Funcionários do Restaurante)
// ============================================

export const tenantUsers = pgTable(
  "tenant_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    firebaseUid: varchar("firebase_uid", { length: 128 }),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    /** Tipo de usuário (perfil de acesso) */
    userTypeId: uuid("user_type_id").references(() => userTypes.id, {
      onDelete: "set null",
    }),
    role: userRoleEnum("role").notNull().default("CASHIER"),
    /** Foto do funcionário (URL Cloudinary) */
    photoUrl: text("photo_url"),
    /** PIN de 4-6 dígitos para troca rápida de operador */
    pin: varchar("pin", { length: 6 }),
    isActive: boolean("is_active").notNull().default(true),
    permissions: jsonb("permissions").$type<Record<string, boolean>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("tenant_users_firebase_uid_idx").on(table.firebaseUid),
    index("tenant_users_tenant_idx").on(table.tenantId),
    index("tenant_users_pin_idx").on(table.tenantId, table.pin),
  ]
);

// ============================================
// ACTIVITY LOGS (Log de Atividades)
// ============================================

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Quem realizou a ação */
    userId: uuid("user_id").references(() => tenantUsers.id, {
      onDelete: "set null",
    }),
    userName: varchar("user_name", { length: 255 }).notNull(),
    action: activityActionEnum("action").notNull(),
    /** Descrição legível da ação */
    description: varchar("description", { length: 500 }).notNull(),
    /** Dados extras (ex: ID do pedido, valor, etc.) */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** IP de onde a ação foi realizada */
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("activity_logs_tenant_created_idx").on(
      table.tenantId,
      table.createdAt
    ),
    index("activity_logs_tenant_user_idx").on(table.tenantId, table.userId),
  ]
);

// ============================================
// CUSTOMERS (Clientes)
// ============================================

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firebaseUid: varchar("firebase_uid", { length: 128 }),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    /** CPF do cliente (formato: 123.456.789-00) */
    cpf: varchar("cpf", { length: 14 }),
    /** Origem do cadastro: POS, ONLINE, MANUAL, etc. */
    source: varchar("source", { length: 50 }),
    addresses: jsonb("addresses").$type<
      Array<{
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
      }>
    >(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("customers_phone_idx").on(table.phone),
    index("customers_cpf_idx").on(table.cpf),
  ]
);

// ============================================
// CUSTOMER-TENANT (Relação cliente ↔ restaurante)
// ============================================

export const customerTenants = pgTable("customer_tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  loyaltyPointsBalance: integer("loyalty_points_balance").notNull().default(0),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  firstOrderAt: timestamp("first_order_at"),
  lastOrderAt: timestamp("last_order_at"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================
// CATEGORIES (Categorias do Cardápio)
// ============================================

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    /** Visível no link de pedidos (clientes) */
    isActivePublic: boolean("is_active_public").notNull().default(true),
    /** Visível no POS (atendentes) */
    isActivePOS: boolean("is_active_pos").notNull().default(true),
    /** Se true, a categoria tem tamanhos (ex: Pizza P, M, G) e os produtos usam preço por tamanho */
    hasSizes: boolean("has_sizes").notNull().default(false),
    /** Horário em que a categoria fica visível (ex: "Almoço" só aparece 11h-15h) */
    schedule: jsonb("schedule").$type<{
      enabled: boolean;
      days: number[]; // 0=Dom, 1=Seg, ..., 6=Sab
      startTime: string; // "11:00"
      endTime: string; // "15:00"
    }>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("categories_tenant_sort_idx").on(table.tenantId, table.sortOrder),
  ]
);

// ============================================
// CATEGORY SIZES (Tamanhos da Categoria)
// Ex: Pizza → Pequena (2 sabores), Média (2 sabores), Grande (3 sabores), Gigante (4 sabores)
// ============================================

export const categorySizes = pgTable("category_sizes", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  /** Número máximo de sabores que podem ser mixados nesse tamanho */
  maxFlavors: integer("max_flavors").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// ============================================
// PRODUCTS (Produtos)
// ============================================

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    /** Preço base (quando não tem variantes) */
    price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
    /** Preço riscado (para mostrar desconto visual) */
    originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
    imageUrl: text("image_url"),
    /** Tag "Novo" para destacar produto */
    isNew: boolean("is_new").notNull().default(false),
    /** Se o produto tem variantes (P, M, G), o preço base é ignorado */
    hasVariants: boolean("has_variants").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    /** Visível no link de pedidos (clientes) */
    isActivePublic: boolean("is_active_public").notNull().default(true),
    /** Visível no POS (atendentes) */
    isActivePOS: boolean("is_active_pos").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("products_tenant_category_idx").on(table.tenantId, table.categoryId),
    index("products_tenant_active_idx").on(table.tenantId, table.isActive),
  ]
);

// ============================================
// PRODUCT VARIANTS (Variantes/Tamanhos)
// Ex: Pizza P (R$29), M (R$39), G (R$49)
// ============================================

export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  /** Preço riscado para a variante */
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// ============================================
// PRODUCT SIZE PRICES (Preço por Tamanho)
// Ex: Pizza Margherita → Pequena R$29, Média R$39, Grande R$49
// ============================================

export const productSizePrices = pgTable(
  "product_size_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sizeId: uuid("size_id")
      .notNull()
      .references(() => categorySizes.id, { onDelete: "cascade" }),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  },
  (table) => [
    uniqueIndex("product_size_price_unique_idx").on(table.productId, table.sizeId),
  ]
);

// ============================================
// CUSTOMIZATION GROUPS (Grupos de Personalização)
// Ex: "Adicionais", "Remover Ingredientes", "Escolha o Molho"
// ============================================

export const customizationGroups = pgTable("customization_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  /** Quantidade mínima de opções que o cliente DEVE escolher (0 = opcional) */
  minSelections: integer("min_selections").notNull().default(0),
  /** Quantidade máxima de opções que o cliente pode escolher */
  maxSelections: integer("max_selections").notNull().default(1),
  /** Se true, é obrigatório escolher pelo menos minSelections opções */
  isRequired: boolean("is_required").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ============================================
// CUSTOMIZATION OPTIONS (Opções de Personalização)
// Ex: "Bacon extra +R$5", "Sem cebola (grátis)"
// ============================================

export const customizationOptions = pgTable("customization_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => customizationGroups.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  /** Preço adicional (0 = grátis, como "Sem cebola") */
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// ============================================
// INGREDIENTS (Catálogo de Ingredientes compartilhados)
// ============================================

export const ingredients = pgTable(
  "ingredients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    /** QUANTITY = contável (ovo, queijo), DESCRIPTION = descritivo (maionese, milho) */
    type: ingredientTypeEnum("type").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ingredients_tenant_idx").on(table.tenantId),
    uniqueIndex("ingredients_tenant_name_idx").on(table.tenantId, table.name),
  ]
);

// ============================================
// PRODUCT INGREDIENTS (Config por produto)
// ============================================

export const productIngredients = pgTable(
  "product_ingredients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    /** Para QUANTITY: quantidade padrão (ex: 1 queijo). Para DESCRIPTION: ignorado */
    defaultQuantity: integer("default_quantity").notNull().default(1),
    /** Para DESCRIPTION: estado padrão "COM" ou "SEM". Para QUANTITY: ignorado */
    defaultState: varchar("default_state", { length: 10 }).notNull().default("COM"),
    /** Preço por unidade adicional (QUANTITY) ou por upgrade (DESCRIPTION) */
    additionalPrice: decimal("additional_price", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    /** Peso em gramas (opcional, para cálculo de custo) */
    weightGrams: decimal("weight_grams", { precision: 10, scale: 2 }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex("product_ingredient_unique_idx").on(
      table.productId,
      table.ingredientId
    ),
    index("product_ingredients_product_idx").on(table.productId),
  ]
);

// ============================================
// ORDER ITEM INGREDIENTS (Snapshot de modificações)
// ============================================

export const orderItemIngredients = pgTable("order_item_ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  /** Snapshot do nome do ingrediente */
  ingredientName: varchar("ingredient_name", { length: 255 }).notNull(),
  /** Texto da modificação: "SEM Queijo", "+2 Ovo", "MAIS Maionese" */
  modification: varchar("modification", { length: 50 }).notNull(),
  /** Quantidade escolhida (para analytics) */
  quantity: integer("quantity").notNull().default(0),
  /** Preço adicional cobrado */
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
});

// ============================================
// DELIVERY AREAS (Áreas de Entrega)
// ============================================

export const deliveryAreas = pgTable(
  "delivery_areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    /** Polígono da área: array de coordenadas lat/lng */
    polygon: jsonb("polygon")
      .notNull()
      .$type<Array<{ lat: number; lng: number }>>(),
    /** Taxa de entrega para esta área */
    deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull(),
    /** Tempo estimado de entrega em minutos */
    estimatedMinutes: integer("estimated_minutes"),
    /** Valor acima do qual a entrega é grátis (null = sem frete grátis) */
    freeDeliveryAbove: decimal("free_delivery_above", {
      precision: 10,
      scale: 2,
    }),
    /** Restrição de horário (opcional) */
    schedule: jsonb("schedule").$type<{
      enabled: boolean;
      days: number[];
      startTime: string;
      endTime: string;
    }>(),
    /** Cor do polígono no mapa */
    color: varchar("color", { length: 7 }).notNull().default("#3b82f6"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("delivery_areas_tenant_idx").on(table.tenantId)]
);

// ============================================
// ORDERS (Pedidos)
// ============================================

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    /** Número sequencial por tenant (para controle interno) */
    orderNumber: integer("order_number").notNull(),
    /** Número exibido ao cliente (ex: #0042) */
    displayNumber: varchar("display_number", { length: 20 }).notNull(),
    status: orderStatusEnum("status").notNull().default("PENDING"),
    type: orderTypeEnum("type").notNull(),
    source: orderSourceEnum("source").notNull().default("ONLINE"),
    /** Dados do cliente denormalizados (para pedidos anônimos) */
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
    /** Número da mesa (para pedidos tipo TABLE) */
    tableNumber: integer("table_number"),
    /** Entregador atribuído (para pedidos tipo DELIVERY) */
    deliveryPersonId: uuid("delivery_person_id").references(
      () => tenantUsers.id,
      { onDelete: "set null" }
    ),
    /** Área de entrega detectada */
    deliveryAreaId: uuid("delivery_area_id").references(
      () => deliveryAreas.id,
      { onDelete: "set null" }
    ),
    /** Endereço de entrega (null se retirada) */
    deliveryAddress: jsonb("delivery_address").$type<{
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
    }>(),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    discount: decimal("discount", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    /** Promoção aplicada (se houver) */
    promotionId: uuid("promotion_id"),
    /** Pontos de fidelidade ganhos neste pedido */
    loyaltyPointsEarned: integer("loyalty_points_earned").notNull().default(0),
    /** Desconto de recompensa aplicado */
    loyaltyDiscount: decimal("loyalty_discount", { precision: 10, scale: 2 }).notNull().default("0"),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("PENDING"),
    /** Troco para (se pagamento em dinheiro) */
    changeFor: decimal("change_for", { precision: 10, scale: 2 }),
    notes: text("notes"),
    estimatedMinutes: integer("estimated_minutes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("orders_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("orders_tenant_status_idx").on(table.tenantId, table.status),
  ]
);

// ============================================
// ORDER ITEMS (Itens do Pedido - snapshot)
// ============================================

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Referência ao produto original (nullable se produto foi deletado) */
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    productVariantId: uuid("product_variant_id").references(
      () => productVariants.id,
      { onDelete: "set null" }
    ),
    /** Snapshots dos nomes no momento do pedido */
    productName: varchar("product_name", { length: 255 }).notNull(),
    variantName: varchar("variant_name", { length: 100 }),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("order_items_order_id_idx").on(table.orderId)]
);

// ============================================
// ORDER ITEM CUSTOMIZATIONS (Personalizações do Item)
// ============================================

export const orderItemCustomizations = pgTable("order_item_customizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  /** Snapshots dos nomes no momento do pedido */
  customizationGroupName: varchar("customization_group_name", {
    length: 255,
  }).notNull(),
  customizationOptionName: varchar("customization_option_name", {
    length: 255,
  }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
});

// ============================================
// PROMOTIONS (Promoções)
// ============================================

export const promotions = pgTable(
  "promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Código do cupom (ex: DESCONTO10) */
    code: varchar("code", { length: 50 }).notNull(),
    description: varchar("description", { length: 500 }),
    type: promotionTypeEnum("type").notNull(),
    /** Valor: percentual (ex: 10 = 10%) ou fixo (ex: 5.00 = R$5) */
    value: decimal("value", { precision: 10, scale: 2 }).notNull(),
    /** Valor mínimo do pedido para aplicar */
    minOrderValue: decimal("min_order_value", { precision: 10, scale: 2 }),
    /** Teto de desconto para promoções percentuais */
    maxDiscount: decimal("max_discount", { precision: 10, scale: 2 }),
    /** Limite total de usos (null = ilimitado) */
    maxUses: integer("max_uses"),
    /** Limite de usos por cliente/telefone */
    maxUsesPerCustomer: integer("max_uses_per_customer").notNull().default(1),
    startDate: timestamp("start_date").notNull().defaultNow(),
    endDate: timestamp("end_date"),
    /** Preço fixo do combo (para tipos COMBO e BUY_X_GET_Y) */
    bundlePrice: decimal("bundle_price", { precision: 10, scale: 2 }),
    /** Dias da semana válidos (0=Dom, 1=Seg, ..., 6=Sáb). null = todos */
    daysOfWeek: jsonb("days_of_week").$type<number[]>(),
    /** Horário início (formato "HH:mm"). null = sem restrição */
    timeStart: varchar("time_start", { length: 5 }),
    /** Horário fim (formato "HH:mm"). null = sem restrição */
    timeEnd: varchar("time_end", { length: 5 }),
    /** Quantidade máxima de escolhas para combos tipo "Escolha X" */
    maxChoices: integer("max_choices"),
    /** URL da imagem/banner da promoção */
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("promotions_tenant_active_idx").on(table.tenantId, table.isActive),
  ]
);

// ============================================
// PROMOTION ITEMS (Itens do combo/promoção)
// ============================================

export const promotionItems = pgTable(
  "promotion_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    /** Produto vinculado (pode ser null se for uma categoria inteira) */
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    /** Categoria vinculada (alternativa ao productId) */
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "cascade",
    }),
    /** Quantidade necessária deste item no combo */
    quantity: integer("quantity").notNull().default(1),
    /** Tipo: REQUIRED = obrigatório no combo, FREE = item grátis (BUY_X_GET_Y) */
    role: varchar("role", { length: 20 }).notNull().default("REQUIRED"),
    /** Preço especial deste item no combo (null = usa preço original) */
    specialPrice: decimal("special_price", { precision: 10, scale: 2 }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("promo_items_promotion_idx").on(table.promotionId),
  ]
);

// ============================================
// PROMOTION USAGE (Registro de uso de promoções)
// ============================================

export const promotionUsage = pgTable(
  "promotion_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Telefone do cliente (para rastrear uso por cliente anônimo) */
    customerPhone: varchar("customer_phone", { length: 20 }),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("promotion_usage_promo_phone_idx").on(table.promotionId, table.customerPhone),
  ]
);

// ============================================
// CASH REGISTER SESSIONS (Sessões de Caixa)
// ============================================

export const cashRegisterSessions = pgTable(
  "cash_register_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Quem abriu o caixa */
    openedBy: varchar("opened_by", { length: 255 }).notNull(),
    /** Quem fechou o caixa */
    closedBy: varchar("closed_by", { length: 255 }),
    openingBalance: decimal("opening_balance", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    closingBalance: decimal("closing_balance", { precision: 10, scale: 2 }),
    expectedBalance: decimal("expected_balance", { precision: 10, scale: 2 }),
    status: cashSessionStatusEnum("status").notNull().default("OPEN"),
    openedAt: timestamp("opened_at").notNull().defaultNow(),
    closedAt: timestamp("closed_at"),
    notes: text("notes"),
  },
  (table) => [
    index("cash_sessions_tenant_status_idx").on(table.tenantId, table.status),
  ]
);

// ============================================
// CASH REGISTER TRANSACTIONS (Movimentações do Caixa)
// ============================================

export const cashRegisterTransactions = pgTable("cash_register_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => cashRegisterSessions.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  type: cashTransactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: varchar("description", { length: 500 }),
  /** Referência ao pedido (se for venda) */
  orderId: uuid("order_id").references(() => orders.id, {
    onDelete: "set null",
  }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================
// LOYALTY CONFIG (Configuração de fidelidade por restaurante)
// ============================================

export const loyaltyConfig = pgTable("loyalty_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .unique(),
  /** Se o sistema de fidelidade está ativo */
  isActive: boolean("is_active").notNull().default(false),
  /** Base de valor em R$ para ganhar pontos (ex: a cada R$10 gastos) */
  spendingBase: decimal("spending_base", { precision: 10, scale: 2 })
    .notNull()
    .default("1"),
  /** Quantos pontos o cliente ganha por spendingBase gasto */
  pointsPerReal: decimal("points_per_real", { precision: 10, scale: 2 })
    .notNull()
    .default("1"),
  /** Nome dos pontos (ex: "Pontos", "Estrelas", "Moedas") */
  pointsName: varchar("points_name", { length: 50 }).notNull().default("Pontos"),
  /** Valor mínimo do pedido para ganhar pontos */
  minOrderForPoints: decimal("min_order_for_points", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================
// LOYALTY REWARDS (Recompensas resgatáveis)
// ============================================

export const loyaltyRewards = pgTable("loyalty_rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  /** Nome da recompensa (ex: "Desconto de R$10", "Refrigerante grátis") */
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 500 }),
  /** Custo em pontos para resgatar */
  pointsCost: integer("points_cost").notNull(),
  /** Valor do desconto em R$ que a recompensa dá */
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  /** Limite total de resgates (null = ilimitado) */
  maxRedemptions: integer("max_redemptions"),
  /** Quantas vezes já foi resgatada */
  totalRedemptions: integer("total_redemptions").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================
// LOYALTY TRANSACTIONS (Histórico de pontos)
// ============================================

export const loyaltyTransactions = pgTable(
  "loyalty_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Telefone do cliente (identificador anônimo) */
    customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
    type: loyaltyTransactionTypeEnum("type").notNull(),
    /** Pontos ganhos (positivo) ou gastos (negativo) */
    points: integer("points").notNull(),
    /** Descrição (ex: "Pedido #0042", "Resgate: Desconto R$10") */
    description: varchar("description", { length: 500 }),
    /** Referência ao pedido (se ganho por pedido) */
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    /** Referência à recompensa (se resgate) */
    rewardId: uuid("reward_id").references(() => loyaltyRewards.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("loyalty_tx_tenant_phone_idx").on(table.tenantId, table.customerPhone),
  ]
);

// ============================================
// REVIEWS (Avaliações de pedidos)
// ============================================

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Nota de 1 a 5 estrelas */
    rating: integer("rating").notNull(),
    /** Comentário opcional */
    comment: text("comment"),
    /** Nome do cliente */
    customerName: varchar("customer_name", { length: 255 }),
    /** Telefone do cliente */
    customerPhone: varchar("customer_phone", { length: 20 }),
    /** Resposta do restaurante */
    reply: text("reply"),
    repliedAt: timestamp("replied_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("reviews_tenant_created_idx").on(table.tenantId, table.createdAt),
  ]
);

// ============================================
// BILLING PLANS (Planos de cobrança)
// ============================================

export const billingPlans = pgTable("billing_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  /** Quantidade de pedidos grátis por mês */
  freeOrdersLimit: integer("free_orders_limit").notNull().default(0),
  /** Percentual cobrado sobre vendas acima do limite */
  percentageFee: decimal("percentage_fee", { precision: 5, scale: 2 }).notNull().default("5"),
  /** Mensalidade mínima (null = sem mínimo) */
  minMonthlyFee: decimal("min_monthly_fee", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================
// TENANT SUBSCRIPTIONS (Assinatura do restaurante)
// ============================================

export const tenantSubscriptions = pgTable("tenant_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .unique(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => billingPlans.id),
  status: subscriptionStatusEnum("status").notNull().default("ACTIVE"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================
// BILLING RECORDS (Cobranças mensais)
// ============================================

export const billingRecords = pgTable(
  "billing_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => tenantSubscriptions.id),
    /** Período de referência */
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    /** Métricas do período */
    totalOrders: integer("total_orders").notNull().default(0),
    totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).notNull().default("0"),
    freeOrders: integer("free_orders").notNull().default(0),
    billedOrders: integer("billed_orders").notNull().default(0),
    /** Cálculo da cobrança */
    percentageFee: decimal("percentage_fee", { precision: 5, scale: 2 }).notNull(),
    calculatedAmount: decimal("calculated_amount", { precision: 10, scale: 2 }).notNull(),
    finalAmount: decimal("final_amount", { precision: 10, scale: 2 }).notNull(),
    status: billingStatusEnum("status").notNull().default("PENDING"),
    paidAt: timestamp("paid_at"),
    dueDate: timestamp("due_date").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("billing_records_tenant_period_idx").on(table.tenantId, table.periodStart),
  ]
);

// ============================================
// AI CHAT HISTORY
// ============================================

export const aiMessageRoleEnum = pgEnum("ai_message_role", [
  "user",
  "assistant",
]);

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 100 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ai_conversations_tenant_idx").on(table.tenantId),
    index("ai_conversations_updated_idx").on(table.tenantId, table.updatedAt),
  ]
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: varchar("id", { length: 100 }).primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: aiMessageRoleEnum("role").notNull(),
    parts: jsonb("parts").notNull().$type<unknown[]>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_messages_conversation_idx").on(table.conversationId),
    index("ai_messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt
    ),
  ]
);

// ============================================
// FISCAL (Nota Fiscal / NFC-e)
// ============================================

export const fiscalConfigs = pgTable("fiscal_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .unique(),
  provider: fiscalProviderEnum("provider").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  emissionMode: fiscalEmissionModeEnum("emission_mode")
    .notNull()
    .default("MANUAL"),

  /** Credenciais da API criptografadas (JSON com AES-256-GCM) */
  encryptedCredentials: text("encrypted_credentials").notNull(),

  // Dados fiscais da empresa
  cnpj: varchar("cnpj", { length: 18 }).notNull(),
  inscricaoEstadual: varchar("inscricao_estadual", { length: 20 }),
  razaoSocial: varchar("razao_social", { length: 255 }).notNull(),
  nomeFantasia: varchar("nome_fantasia", { length: 255 }),
  /** 1=Simples Nacional, 2=SN Excesso, 3=Regime Normal */
  regimeTributario: integer("regime_tributario").notNull().default(1),

  /** 1=Produção, 2=Homologação (teste) */
  ambiente: integer("ambiente").notNull().default(2),

  // CSC (Código de Segurança do Contribuinte) para NFC-e
  cscId: varchar("csc_id", { length: 10 }),
  encryptedCsc: text("encrypted_csc"),

  // Série e numeração da NFC-e
  serieNfce: integer("serie_nfce").notNull().default(1),
  proximoNumeroNfce: integer("proximo_numero_nfce").notNull().default(1),

  // Defaults tributários para produtos
  defaultCfop: varchar("default_cfop", { length: 4 }).notNull().default("5102"),
  defaultCsosn: varchar("default_csosn", { length: 4 })
    .notNull()
    .default("102"),
  defaultNcm: varchar("default_ncm", { length: 8 })
    .notNull()
    .default("21069090"),

  // Endereço fiscal
  logradouro: varchar("logradouro", { length: 255 }),
  numeroEndereco: varchar("numero_endereco", { length: 20 }),
  bairro: varchar("bairro", { length: 100 }),
  codigoMunicipio: varchar("codigo_municipio", { length: 7 }),
  municipio: varchar("municipio", { length: 100 }),
  uf: varchar("uf", { length: 2 }),
  cep: varchar("cep", { length: 9 }),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const fiscalDocuments = pgTable(
  "fiscal_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),

    status: fiscalDocumentStatusEnum("status").notNull().default("PENDING"),
    provider: fiscalProviderEnum("provider").notNull(),

    // Dados da NFC-e autorizada
    chaveAcesso: varchar("chave_acesso", { length: 44 }),
    numeroNfce: integer("numero_nfce"),
    serieNfce: integer("serie_nfce"),
    protocolo: varchar("protocolo", { length: 20 }),
    danfeUrl: text("danfe_url"),
    xmlUrl: text("xml_url"),

    // Dados de erro
    errorCode: varchar("error_code", { length: 10 }),
    errorMessage: text("error_message"),

    // Cancelamento
    cancelledAt: timestamp("cancelled_at"),
    cancelProtocolo: varchar("cancel_protocolo", { length: 20 }),
    cancelReason: text("cancel_reason"),

    // Controle de retry
    retryCount: integer("retry_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at"),
    nextRetryAt: timestamp("next_retry_at"),

    // Resposta completa do provedor (auditoria)
    providerResponse: jsonb("provider_response").$type<
      Record<string, unknown>
    >(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("fiscal_docs_tenant_created_idx").on(
      table.tenantId,
      table.createdAt
    ),
    index("fiscal_docs_tenant_status_idx").on(table.tenantId, table.status),
    index("fiscal_docs_order_idx").on(table.orderId),
    uniqueIndex("fiscal_docs_chave_idx").on(table.chaveAcesso),
  ]
);

// ============================================
// RELATIONS
// ============================================

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  users: many(tenantUsers),
  userTypes: many(userTypes),
  activityLogs: many(activityLogs),
  customerTenants: many(customerTenants),
  categories: many(categories),
  products: many(products),
  orders: many(orders),
  promotions: many(promotions),
  deliveryAreas: many(deliveryAreas),
  ingredients: many(ingredients),
  aiConversations: many(aiConversations),
  fiscalConfig: one(fiscalConfigs),
  fiscalDocuments: many(fiscalDocuments),
}));

export const aiConversationsRelations = relations(
  aiConversations,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [aiConversations.tenantId],
      references: [tenants.id],
    }),
    messages: many(aiMessages),
  })
);

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
  conversation: one(aiConversations, {
    fields: [aiMessages.conversationId],
    references: [aiConversations.id],
  }),
}));

export const userTypesRelations = relations(userTypes, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [userTypes.tenantId],
    references: [tenants.id],
  }),
  users: many(tenantUsers),
}));

export const tenantUsersRelations = relations(tenantUsers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantUsers.tenantId],
    references: [tenants.id],
  }),
  userType: one(userTypes, {
    fields: [tenantUsers.userTypeId],
    references: [userTypes.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [activityLogs.tenantId],
    references: [tenants.id],
  }),
  user: one(tenantUsers, {
    fields: [activityLogs.userId],
    references: [tenantUsers.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  customerTenants: many(customerTenants),
}));

export const customerTenantsRelations = relations(
  customerTenants,
  ({ one }) => ({
    customer: one(customers, {
      fields: [customerTenants.customerId],
      references: [customers.id],
    }),
    tenant: one(tenants, {
      fields: [customerTenants.tenantId],
      references: [tenants.id],
    }),
  })
);

// --- Menu Relations ---

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [categories.tenantId],
    references: [tenants.id],
  }),
  products: many(products),
  sizes: many(categorySizes),
}));

export const categorySizesRelations = relations(categorySizes, ({ one, many }) => ({
  category: one(categories, {
    fields: [categorySizes.categoryId],
    references: [categories.id],
  }),
  productPrices: many(productSizePrices),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [products.tenantId],
    references: [tenants.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
  sizePrices: many(productSizePrices),
  customizationGroups: many(customizationGroups),
  ingredients: many(productIngredients),
}));

export const productSizePricesRelations = relations(productSizePrices, ({ one }) => ({
  product: one(products, {
    fields: [productSizePrices.productId],
    references: [products.id],
  }),
  size: one(categorySizes, {
    fields: [productSizePrices.sizeId],
    references: [categorySizes.id],
  }),
}));

export const productVariantsRelations = relations(
  productVariants,
  ({ one }) => ({
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
  })
);

export const customizationGroupsRelations = relations(
  customizationGroups,
  ({ one, many }) => ({
    product: one(products, {
      fields: [customizationGroups.productId],
      references: [products.id],
    }),
    options: many(customizationOptions),
  })
);

export const customizationOptionsRelations = relations(
  customizationOptions,
  ({ one }) => ({
    group: one(customizationGroups, {
      fields: [customizationOptions.groupId],
      references: [customizationGroups.id],
    }),
  })
);

// --- Ingredient Relations ---

export const ingredientsRelations = relations(ingredients, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [ingredients.tenantId],
    references: [tenants.id],
  }),
  productIngredients: many(productIngredients),
}));

export const productIngredientsRelations = relations(
  productIngredients,
  ({ one }) => ({
    product: one(products, {
      fields: [productIngredients.productId],
      references: [products.id],
    }),
    ingredient: one(ingredients, {
      fields: [productIngredients.ingredientId],
      references: [ingredients.id],
    }),
  })
);

export const orderItemIngredientsRelations = relations(
  orderItemIngredients,
  ({ one }) => ({
    orderItem: one(orderItems, {
      fields: [orderItemIngredients.orderItemId],
      references: [orderItems.id],
    }),
  })
);

// --- Order Relations ---

export const deliveryAreasRelations = relations(
  deliveryAreas,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [deliveryAreas.tenantId],
      references: [tenants.id],
    }),
  })
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [orders.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  promotion: one(promotions, {
    fields: [orders.promotionId],
    references: [promotions.id],
  }),
  deliveryPerson: one(tenantUsers, {
    fields: [orders.deliveryPersonId],
    references: [tenantUsers.id],
  }),
  deliveryArea: one(deliveryAreas, {
    fields: [orders.deliveryAreaId],
    references: [deliveryAreas.id],
  }),
  items: many(orderItems),
  fiscalDocuments: many(fiscalDocuments),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  productVariant: one(productVariants, {
    fields: [orderItems.productVariantId],
    references: [productVariants.id],
  }),
  customizations: many(orderItemCustomizations),
  ingredientModifications: many(orderItemIngredients),
}));

export const orderItemCustomizationsRelations = relations(
  orderItemCustomizations,
  ({ one }) => ({
    orderItem: one(orderItems, {
      fields: [orderItemCustomizations.orderItemId],
      references: [orderItems.id],
    }),
  })
);

// --- Cash Register Relations ---

export const cashRegisterSessionsRelations = relations(
  cashRegisterSessions,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [cashRegisterSessions.tenantId],
      references: [tenants.id],
    }),
    transactions: many(cashRegisterTransactions),
  })
);

export const cashRegisterTransactionsRelations = relations(
  cashRegisterTransactions,
  ({ one }) => ({
    session: one(cashRegisterSessions, {
      fields: [cashRegisterTransactions.sessionId],
      references: [cashRegisterSessions.id],
    }),
    tenant: one(tenants, {
      fields: [cashRegisterTransactions.tenantId],
      references: [tenants.id],
    }),
    order: one(orders, {
      fields: [cashRegisterTransactions.orderId],
      references: [orders.id],
    }),
  })
);

// --- Promotion Relations ---

export const promotionsRelations = relations(promotions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [promotions.tenantId],
    references: [tenants.id],
  }),
  items: many(promotionItems),
  usage: many(promotionUsage),
}));

export const promotionItemsRelations = relations(
  promotionItems,
  ({ one }) => ({
    promotion: one(promotions, {
      fields: [promotionItems.promotionId],
      references: [promotions.id],
    }),
    product: one(products, {
      fields: [promotionItems.productId],
      references: [products.id],
    }),
    category: one(categories, {
      fields: [promotionItems.categoryId],
      references: [categories.id],
    }),
  })
);

export const promotionUsageRelations = relations(
  promotionUsage,
  ({ one }) => ({
    promotion: one(promotions, {
      fields: [promotionUsage.promotionId],
      references: [promotions.id],
    }),
    order: one(orders, {
      fields: [promotionUsage.orderId],
      references: [orders.id],
    }),
    tenant: one(tenants, {
      fields: [promotionUsage.tenantId],
      references: [tenants.id],
    }),
  })
);

// --- Loyalty Relations ---

export const loyaltyConfigRelations = relations(loyaltyConfig, ({ one }) => ({
  tenant: one(tenants, {
    fields: [loyaltyConfig.tenantId],
    references: [tenants.id],
  }),
}));

export const loyaltyRewardsRelations = relations(
  loyaltyRewards,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [loyaltyRewards.tenantId],
      references: [tenants.id],
    }),
  })
);

export const loyaltyTransactionsRelations = relations(
  loyaltyTransactions,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [loyaltyTransactions.tenantId],
      references: [tenants.id],
    }),
    order: one(orders, {
      fields: [loyaltyTransactions.orderId],
      references: [orders.id],
    }),
    reward: one(loyaltyRewards, {
      fields: [loyaltyTransactions.rewardId],
      references: [loyaltyRewards.id],
    }),
  })
);

// --- Review Relations ---

export const reviewsRelations = relations(reviews, ({ one }) => ({
  tenant: one(tenants, {
    fields: [reviews.tenantId],
    references: [tenants.id],
  }),
  order: one(orders, {
    fields: [reviews.orderId],
    references: [orders.id],
  }),
}));

// --- Billing Relations ---

export const billingPlansRelations = relations(billingPlans, ({ many }) => ({
  subscriptions: many(tenantSubscriptions),
}));

export const tenantSubscriptionsRelations = relations(
  tenantSubscriptions,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [tenantSubscriptions.tenantId],
      references: [tenants.id],
    }),
    plan: one(billingPlans, {
      fields: [tenantSubscriptions.planId],
      references: [billingPlans.id],
    }),
    billingRecords: many(billingRecords),
  })
);

export const billingRecordsRelations = relations(
  billingRecords,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [billingRecords.tenantId],
      references: [tenants.id],
    }),
    subscription: one(tenantSubscriptions, {
      fields: [billingRecords.subscriptionId],
      references: [tenantSubscriptions.id],
    }),
  })
);

// --- Fiscal Relations ---

export const fiscalConfigsRelations = relations(
  fiscalConfigs,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [fiscalConfigs.tenantId],
      references: [tenants.id],
    }),
  })
);

export const fiscalDocumentsRelations = relations(
  fiscalDocuments,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [fiscalDocuments.tenantId],
      references: [tenants.id],
    }),
    order: one(orders, {
      fields: [fiscalDocuments.orderId],
      references: [orders.id],
    }),
  })
);
