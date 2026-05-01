ALTER TABLE "loyalty_rewards" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "loyalty_rewards" CASCADE;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" DROP CONSTRAINT "loyalty_transactions_reward_id_loyalty_rewards_id_fk";
--> statement-breakpoint
DROP INDEX "customers_cpf_idx";--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "paid_with_points" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "points_unit_cost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "points_total_cost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "points_spent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_ingredients" ADD COLUMN "max_quantity" integer;--> statement-breakpoint
ALTER TABLE "product_size_prices" ADD COLUMN "points_price" integer;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "points_price" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "points_price" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_cpf_unique_idx" ON "customers" USING btree ("cpf");--> statement-breakpoint
CREATE INDEX "products_tenant_points_idx" ON "products" USING btree ("tenant_id") WHERE "products"."points_price" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" DROP COLUMN "reward_id";