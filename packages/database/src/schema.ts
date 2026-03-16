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
    paymentMethodsAccepted: jsonb("payment_methods_accepted").$type<string[]>(),
    themeSettings: jsonb("theme_settings").$type<{
      primaryColor: string;
      secondaryColor: string;
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
// TENANT USERS (Funcionários do Restaurante)
// ============================================

export const tenantUsers = pgTable("tenant_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  firebaseUid: varchar("firebase_uid", { length: 128 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  role: userRoleEnum("role").notNull().default("CASHIER"),
  isActive: boolean("is_active").notNull().default(true),
  permissions: jsonb("permissions").$type<Record<string, boolean>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================
// CUSTOMERS (Clientes)
// ============================================

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  firebaseUid: varchar("firebase_uid", { length: 128 }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
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
    }>
  >(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

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

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
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
});

// ============================================
// PRODUCTS (Produtos)
// ============================================

export const products = pgTable("products", {
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

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
// ORDERS (Pedidos)
// ============================================

export const orders = pgTable("orders", {
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
  /** Endereço de entrega (null se retirada) */
  deliveryAddress: jsonb("delivery_address").$type<{
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  }>(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
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
});

// ============================================
// ORDER ITEMS (Itens do Pedido - snapshot)
// ============================================

export const orderItems = pgTable("order_items", {
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
});

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
// CASH REGISTER SESSIONS (Sessões de Caixa)
// ============================================

export const cashRegisterSessions = pgTable("cash_register_sessions", {
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
});

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
// RELATIONS
// ============================================

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(tenantUsers),
  customerTenants: many(customerTenants),
  categories: many(categories),
  products: many(products),
  orders: many(orders),
}));

export const tenantUsersRelations = relations(tenantUsers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantUsers.tenantId],
    references: [tenants.id],
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
  customizationGroups: many(customizationGroups),
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

// --- Order Relations ---

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [orders.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
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
