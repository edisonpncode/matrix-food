CREATE TYPE "public"."ingredient_unit" AS ENUM('g', 'ml', 'un');--> statement-breakpoint
CREATE TABLE "ingredient_cost_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"purchase_quantity" numeric(12, 4) NOT NULL,
	"purchase_price" numeric(10, 2) NOT NULL,
	"waste_percent" numeric(5, 4) NOT NULL,
	"unit_cost" numeric(12, 6) NOT NULL,
	"note" text,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sub_recipe_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_ingredient_id" uuid NOT NULL,
	"child_ingredient_id" uuid NOT NULL,
	"quantity" numeric(12, 4) NOT NULL,
	"unit" "ingredient_unit" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customization_options" ADD COLUMN "unit_cost" numeric(10, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "unit" "ingredient_unit" DEFAULT 'un' NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "purchase_quantity" numeric(12, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "purchase_price" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "waste_percent" numeric(5, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "unit_cost" numeric(12, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "is_composite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "yield_quantity" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "order_item_customizations" ADD COLUMN "unit_cost_snapshot" numeric(10, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_cost_snapshot" numeric(10, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_ingredients" ADD COLUMN "quantity" numeric(12, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_ingredients" ADD COLUMN "unit" "ingredient_unit";--> statement-breakpoint
ALTER TABLE "ingredient_cost_history" ADD CONSTRAINT "ingredient_cost_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_cost_history" ADD CONSTRAINT "ingredient_cost_history_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_recipe_items" ADD CONSTRAINT "sub_recipe_items_parent_ingredient_id_ingredients_id_fk" FOREIGN KEY ("parent_ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_recipe_items" ADD CONSTRAINT "sub_recipe_items_child_ingredient_id_ingredients_id_fk" FOREIGN KEY ("child_ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingredient_cost_history_ingredient_idx" ON "ingredient_cost_history" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "ingredient_cost_history_tenant_idx" ON "ingredient_cost_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sub_recipe_unique_idx" ON "sub_recipe_items" USING btree ("parent_ingredient_id","child_ingredient_id");--> statement-breakpoint
CREATE INDEX "sub_recipe_parent_idx" ON "sub_recipe_items" USING btree ("parent_ingredient_id");