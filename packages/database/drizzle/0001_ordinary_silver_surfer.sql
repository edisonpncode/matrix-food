CREATE TYPE "public"."ingredient_type" AS ENUM('QUANTITY', 'DESCRIPTION');--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "ingredient_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"ingredient_name" varchar(255) NOT NULL,
	"modification" varchar(50) NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"default_quantity" integer DEFAULT 1 NOT NULL,
	"default_state" varchar(10) DEFAULT 'COM' NOT NULL,
	"additional_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"weight_grams" numeric(10, 2),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_ingredients" ADD CONSTRAINT "order_item_ingredients_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingredients_tenant_idx" ON "ingredients" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ingredients_tenant_name_idx" ON "ingredients" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "product_ingredient_unique_idx" ON "product_ingredients" USING btree ("product_id","ingredient_id");--> statement-breakpoint
CREATE INDEX "product_ingredients_product_idx" ON "product_ingredients" USING btree ("product_id");