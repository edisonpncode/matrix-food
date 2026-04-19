import { getDb, auditLogs } from "@matrix-food/database";
import type { TRPCContext } from "../trpc";

/**
 * Registra um evento em `audit_logs`. Nunca quebra o fluxo do chamador:
 * erros são apenas logados. Use em ações sensíveis — superadmin, acesso
 * a PII, alterações de config cross-tenant.
 *
 * NÃO incluir campos de CPF, PIN ou senha em `metadata`.
 */
export async function logAudit(params: {
  ctx: Pick<TRPCContext, "user" | "tenantId" | "ip">;
  action: string;
  tenantId?: string | null;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  userAgent?: string | null;
}): Promise<void> {
  try {
    const db = getDb();
    const { ctx } = params;
    const actorEmail = ctx.user?.email ?? null;
    const superadminList = (process.env.SUPERADMIN_EMAILS ?? "")
      .toLowerCase()
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    const isSuperadmin =
      !!actorEmail && superadminList.includes(actorEmail.toLowerCase());
    const actorRole = !ctx.user
      ? "system"
      : isSuperadmin
        ? "superadmin"
        : ctx.user.role === "OWNER"
          ? "owner"
          : "staff";

    await db.insert(auditLogs).values({
      tenantId: params.tenantId ?? ctx.tenantId ?? null,
      actorUid: ctx.user?.uid ?? null,
      actorEmail,
      actorRole,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      metadata: params.metadata,
      ipAddress: ctx.ip ?? null,
      userAgent: params.userAgent ?? null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit] falhou:", err instanceof Error ? err.message : err);
  }
}
