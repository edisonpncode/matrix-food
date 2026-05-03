CREATE TYPE "public"."monthly_sales_range" AS ENUM('NOT_OPENED', 'UP_TO_100K', 'FROM_100K_TO_500K', 'FROM_500K_TO_1M', 'ABOVE_1M');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('ACTIVE', 'WAITLIST', 'SUSPENDED');--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "status" "tenant_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "uses_other_system" boolean;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "current_system_name" varchar(100);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "monthly_sales_range" "monthly_sales_range";--> statement-breakpoint
CREATE UNIQUE INDEX "system_settings_key_idx" ON "system_settings" USING btree ("key");