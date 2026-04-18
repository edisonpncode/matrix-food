CREATE TYPE "public"."morpheu_auth_role" AS ENUM('OWNER', 'MANAGER');--> statement-breakpoint
CREATE TYPE "public"."morpheu_direction" AS ENUM('INBOUND', 'OUTBOUND');--> statement-breakpoint
CREATE TYPE "public"."morpheu_message_status" AS ENUM('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED');--> statement-breakpoint
CREATE TYPE "public"."morpheu_message_type" AS ENUM('TEXT', 'TEMPLATE', 'INTERACTIVE', 'REACTION', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."morpheu_template_status" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED');--> statement-breakpoint
CREATE TABLE "morpheu_authorized_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tenant_user_id" uuid,
	"role" "morpheu_auth_role" NOT NULL,
	"phone_e164" varchar(20),
	"phone_verified" boolean DEFAULT false NOT NULL,
	"phone_verified_at" timestamp,
	"otp_code_hash" varchar(128),
	"otp_expires_at" timestamp,
	"otp_attempts" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "morpheu_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meta_app_id" varchar(64),
	"encrypted_access_token" text,
	"meta_phone_number_id" varchar(64),
	"meta_business_account_id" varchar(64),
	"graph_api_version" varchar(10) DEFAULT 'v21.0' NOT NULL,
	"webhook_verify_token" varchar(128),
	"encrypted_webhook_secret" text,
	"display_name" varchar(50) DEFAULT 'Morpheu' NOT NULL,
	"default_system_prompt" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "morpheu_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"authorized_user_id" uuid,
	"conversation_id" uuid,
	"direction" "morpheu_direction" NOT NULL,
	"message_type" "morpheu_message_type" NOT NULL,
	"template_name" varchar(100),
	"body" text,
	"raw_payload" jsonb,
	"whatsapp_message_id" varchar(128),
	"phone_e164" varchar(20),
	"status" "morpheu_message_status" DEFAULT 'QUEUED' NOT NULL,
	"error_code" varchar(50),
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "morpheu_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(30) DEFAULT 'UTILITY' NOT NULL,
	"language" varchar(10) DEFAULT 'pt_BR' NOT NULL,
	"body_text" text NOT NULL,
	"placeholders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"meta_template_id" varchar(64),
	"status" "morpheu_template_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "morpheu_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "morpheu_tenant_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"notify_cash_open" boolean DEFAULT true NOT NULL,
	"notify_cash_deposit" boolean DEFAULT true NOT NULL,
	"notify_cash_withdraw" boolean DEFAULT true NOT NULL,
	"notify_order_cancel" boolean DEFAULT true NOT NULL,
	"notify_cash_close" boolean DEFAULT true NOT NULL,
	"notify_daily_summary" boolean DEFAULT true NOT NULL,
	"notify_anomaly_alerts" boolean DEFAULT true NOT NULL,
	"quiet_hours_start" varchar(5) DEFAULT '00:00' NOT NULL,
	"quiet_hours_end" varchar(5) DEFAULT '07:00' NOT NULL,
	"digest_mode_enabled" boolean DEFAULT false NOT NULL,
	"digest_window_start" varchar(5) DEFAULT '19:00' NOT NULL,
	"digest_window_end" varchar(5) DEFAULT '22:00' NOT NULL,
	"digest_interval_minutes" integer DEFAULT 30 NOT NULL,
	"timezone" varchar(50) DEFAULT 'America/Sao_Paulo' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "morpheu_tenant_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "morpheu_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meta_event_id" varchar(200) NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"payload" jsonb,
	CONSTRAINT "morpheu_webhook_events_meta_event_id_unique" UNIQUE("meta_event_id")
);
--> statement-breakpoint
ALTER TABLE "morpheu_authorized_users" ADD CONSTRAINT "morpheu_authorized_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morpheu_authorized_users" ADD CONSTRAINT "morpheu_authorized_users_tenant_user_id_tenant_users_id_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morpheu_messages" ADD CONSTRAINT "morpheu_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morpheu_messages" ADD CONSTRAINT "morpheu_messages_authorized_user_id_morpheu_authorized_users_id_fk" FOREIGN KEY ("authorized_user_id") REFERENCES "public"."morpheu_authorized_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morpheu_messages" ADD CONSTRAINT "morpheu_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morpheu_tenant_settings" ADD CONSTRAINT "morpheu_tenant_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "morpheu_auth_users_tenant_idx" ON "morpheu_authorized_users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "morpheu_auth_users_phone_idx" ON "morpheu_authorized_users" USING btree ("phone_e164");--> statement-breakpoint
CREATE UNIQUE INDEX "morpheu_auth_users_tenant_role_active_uniq" ON "morpheu_authorized_users" USING btree ("tenant_id","role") WHERE active = true;--> statement-breakpoint
CREATE INDEX "morpheu_messages_tenant_idx" ON "morpheu_messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "morpheu_messages_auth_user_idx" ON "morpheu_messages" USING btree ("authorized_user_id");--> statement-breakpoint
CREATE INDEX "morpheu_messages_wamid_idx" ON "morpheu_messages" USING btree ("whatsapp_message_id");--> statement-breakpoint
CREATE INDEX "morpheu_messages_created_idx" ON "morpheu_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "morpheu_templates_status_idx" ON "morpheu_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "morpheu_tenant_settings_tenant_idx" ON "morpheu_tenant_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "morpheu_webhook_events_processed_idx" ON "morpheu_webhook_events" USING btree ("processed_at");