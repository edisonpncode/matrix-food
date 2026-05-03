CREATE TYPE "public"."time_off_type" AS ENUM('FOLGA', 'FERIAS');--> statement-breakpoint
ALTER TYPE "public"."activity_action" ADD VALUE 'STAFF_SHIFT_UPDATED' BEFORE 'USER_TYPE_CREATED';--> statement-breakpoint
ALTER TYPE "public"."activity_action" ADD VALUE 'STAFF_SHIFT_DELETED' BEFORE 'USER_TYPE_CREATED';--> statement-breakpoint
ALTER TYPE "public"."activity_action" ADD VALUE 'STAFF_TIME_OFF_CREATED' BEFORE 'USER_TYPE_CREATED';--> statement-breakpoint
ALTER TYPE "public"."activity_action" ADD VALUE 'STAFF_TIME_OFF_DELETED' BEFORE 'USER_TYPE_CREATED';--> statement-breakpoint
ALTER TYPE "public"."activity_action" ADD VALUE 'REPORT_VIEWED';--> statement-breakpoint
ALTER TYPE "public"."activity_action" ADD VALUE 'REPORT_EXPORTED';--> statement-breakpoint
CREATE TABLE "order_cancellations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reason" varchar(60) NOT NULL,
	"cancelled_by_user_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tenant_user_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"notes" varchar(200),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tenant_user_id" uuid NOT NULL,
	"type" time_off_type NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" varchar(300),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loyalty_config" ADD COLUMN "points_expiration_days" integer;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "preparing_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ready_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "out_for_delivery_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp;--> statement-breakpoint
ALTER TABLE "order_cancellations" ADD CONSTRAINT "order_cancellations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_cancellations" ADD CONSTRAINT "order_cancellations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_cancellations" ADD CONSTRAINT "order_cancellations_cancelled_by_user_id_tenant_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_tenant_user_id_tenant_users_id_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_time_off" ADD CONSTRAINT "staff_time_off_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_time_off" ADD CONSTRAINT "staff_time_off_tenant_user_id_tenant_users_id_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_cancellations_order_id_idx" ON "order_cancellations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_cancellations_tenant_created_idx" ON "order_cancellations" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "order_cancellations_reason_idx" ON "order_cancellations" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "staff_shifts_tenant_idx" ON "staff_shifts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "staff_shifts_user_day_idx" ON "staff_shifts" USING btree ("tenant_user_id","day_of_week");--> statement-breakpoint
CREATE INDEX "staff_time_off_tenant_idx" ON "staff_time_off" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "staff_time_off_user_idx" ON "staff_time_off" USING btree ("tenant_user_id");--> statement-breakpoint
CREATE INDEX "staff_time_off_dates_idx" ON "staff_time_off" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "customer_tenants_tenant_last_order_idx" ON "customer_tenants" USING btree ("tenant_id","last_order_at");--> statement-breakpoint
CREATE INDEX "loyalty_tx_expiration_idx" ON "loyalty_transactions" USING btree ("tenant_id","expires_at") WHERE "loyalty_transactions"."type" = 'EARNED' AND "loyalty_transactions"."expires_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "orders_tenant_type_created_idx" ON "orders" USING btree ("tenant_id","type","created_at");