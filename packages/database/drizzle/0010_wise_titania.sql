ALTER TYPE "public"."payment_method" ADD VALUE 'OTHER';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "custom_payment_label" text;