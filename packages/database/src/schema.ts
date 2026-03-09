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
// RELATIONS
// ============================================

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(tenantUsers),
  customerTenants: many(customerTenants),
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
