CREATE TYPE "public"."print_job_receipt_type" AS ENUM('CUSTOMER', 'KITCHEN', 'DELIVERY');--> statement-breakpoint
CREATE TYPE "public"."print_job_status" AS ENUM('PENDING', 'SUCCESS', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."print_job_trigger" AS ENUM('AUTO_NEW_ORDER', 'AUTO_CONFIRMED', 'MANUAL');--> statement-breakpoint
CREATE TABLE "print_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"printer_id" text NOT NULL,
	"printer_name" text NOT NULL,
	"receipt_type" "print_job_receipt_type" NOT NULL,
	"trigger" "print_job_trigger" NOT NULL,
	"status" "print_job_status" DEFAULT 'PENDING' NOT NULL,
	"error_message" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "print_jobs_tenant_order_idx" ON "print_jobs" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "print_jobs_status_idx" ON "print_jobs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "print_jobs_created_at_idx" ON "print_jobs" USING btree ("created_at");