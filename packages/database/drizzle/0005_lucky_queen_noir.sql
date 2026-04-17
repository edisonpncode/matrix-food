CREATE TYPE "public"."delivery_earning_type" AS ENUM('COMMISSION', 'SHORTAGE_DEDUCTION', 'SURPLUS_BONUS', 'PAYOUT');--> statement-breakpoint
CREATE TYPE "public"."fiscal_document_status" AS ENUM('PENDING', 'PROCESSING', 'AUTHORIZED', 'REJECTED', 'CANCELLED', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."fiscal_emission_mode" AS ENUM('AUTOMATIC', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."fiscal_provider" AS ENUM('FOCUS_NFE', 'WEBMANIA', 'NUVEM_FISCAL', 'SAFEWEB');--> statement-breakpoint
CREATE TYPE "public"."shortage_handling" AS ENUM('DISCOUNT_DRIVER', 'ACCEPT_LOSS');--> statement-breakpoint
CREATE TYPE "public"."surplus_handling" AS ENUM('ADD_DRIVER', 'ADD_CASH');--> statement-breakpoint
ALTER TYPE "public"."activity_action" ADD VALUE 'FISCAL_CONFIG_UPDATED';--> statement-breakpoint
ALTER TYPE "public"."activity_action" ADD VALUE 'FISCAL_DOCUMENT_EMITTED';--> statement-breakpoint
ALTER TYPE "public"."activity_action" ADD VALUE 'FISCAL_DOCUMENT_CANCELLED';--> statement-breakpoint
ALTER TYPE "public"."activity_action" ADD VALUE 'FISCAL_DOCUMENT_RETRY';--> statement-breakpoint
ALTER TYPE "public"."cash_transaction_type" ADD VALUE 'REFUND';--> statement-breakpoint
CREATE TABLE "delivery_person_earnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"delivery_person_id" uuid NOT NULL,
	"order_id" uuid,
	"session_id" uuid,
	"type" "delivery_earning_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" text,
	"created_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" "fiscal_provider" NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"emission_mode" "fiscal_emission_mode" DEFAULT 'MANUAL' NOT NULL,
	"encrypted_credentials" text NOT NULL,
	"cnpj" varchar(18) NOT NULL,
	"inscricao_estadual" varchar(20),
	"razao_social" varchar(255) NOT NULL,
	"nome_fantasia" varchar(255),
	"regime_tributario" integer DEFAULT 1 NOT NULL,
	"ambiente" integer DEFAULT 2 NOT NULL,
	"csc_id" varchar(10),
	"encrypted_csc" text,
	"serie_nfce" integer DEFAULT 1 NOT NULL,
	"proximo_numero_nfce" integer DEFAULT 1 NOT NULL,
	"default_cfop" varchar(4) DEFAULT '5102' NOT NULL,
	"default_csosn" varchar(4) DEFAULT '102' NOT NULL,
	"default_ncm" varchar(8) DEFAULT '21069090' NOT NULL,
	"logradouro" varchar(255),
	"numero_endereco" varchar(20),
	"bairro" varchar(100),
	"codigo_municipio" varchar(7),
	"municipio" varchar(100),
	"uf" varchar(2),
	"cep" varchar(9),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_configs_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "fiscal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "fiscal_document_status" DEFAULT 'PENDING' NOT NULL,
	"provider" "fiscal_provider" NOT NULL,
	"chave_acesso" varchar(44),
	"numero_nfce" integer,
	"serie_nfce" integer,
	"protocolo" varchar(20),
	"danfe_url" text,
	"xml_url" text,
	"error_code" varchar(10),
	"error_message" text,
	"cancelled_at" timestamp,
	"cancel_protocolo" varchar(20),
	"cancel_reason" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"next_retry_at" timestamp,
	"provider_response" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cash_register_sessions" ADD COLUMN "counted_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "cash_register_sessions" ADD COLUMN "expected_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "amount_received" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shortage_handling" "shortage_handling";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "surplus_handling" "surplus_handling";--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN "password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "delivery_person_earnings" ADD CONSTRAINT "delivery_person_earnings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_person_earnings" ADD CONSTRAINT "delivery_person_earnings_delivery_person_id_tenant_users_id_fk" FOREIGN KEY ("delivery_person_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_person_earnings" ADD CONSTRAINT "delivery_person_earnings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_person_earnings" ADD CONSTRAINT "delivery_person_earnings_session_id_cash_register_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."cash_register_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_configs" ADD CONSTRAINT "fiscal_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_earnings_tenant_person_idx" ON "delivery_person_earnings" USING btree ("tenant_id","delivery_person_id","created_at");--> statement-breakpoint
CREATE INDEX "delivery_earnings_order_idx" ON "delivery_person_earnings" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "delivery_earnings_session_idx" ON "delivery_person_earnings" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "fiscal_docs_tenant_created_idx" ON "fiscal_documents" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "fiscal_docs_tenant_status_idx" ON "fiscal_documents" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "fiscal_docs_order_idx" ON "fiscal_documents" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_docs_chave_idx" ON "fiscal_documents" USING btree ("chave_acesso");