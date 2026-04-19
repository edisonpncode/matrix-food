CREATE TABLE "superadmin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"event" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "superadmin_audit_logs_email_idx" ON "superadmin_audit_logs" USING btree ("email");--> statement-breakpoint
CREATE INDEX "superadmin_audit_logs_created_at_idx" ON "superadmin_audit_logs" USING btree ("created_at");