ALTER TYPE "public"."activity_action" ADD VALUE 'ORDER_DISCOUNT_APPLIED' BEFORE 'CASH_OPENED';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "default_shift_start_time" varchar(5);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "default_shift_end_time" varchar(5);