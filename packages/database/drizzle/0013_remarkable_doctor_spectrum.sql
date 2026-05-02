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
CREATE UNIQUE INDEX "order_cancellations_order_id_idx" ON "order_cancellations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_cancellations_tenant_created_idx" ON "order_cancellations" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "order_cancellations_reason_idx" ON "order_cancellations" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "customer_tenants_tenant_last_order_idx" ON "customer_tenants" USING btree ("tenant_id","last_order_at");--> statement-breakpoint
CREATE INDEX "loyalty_tx_expiration_idx" ON "loyalty_transactions" USING btree ("tenant_id","expires_at") WHERE "loyalty_transactions"."type" = 'EARNED' AND "loyalty_transactions"."expires_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "orders_tenant_type_created_idx" ON "orders" USING btree ("tenant_id","type","created_at");