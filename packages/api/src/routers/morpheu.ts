import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  superadminProcedure,
  tenantProcedure,
} from "../trpc";
import {
  getDb,
  morpheuConfig,
  morpheuTenantSettings,
  morpheuAuthorizedUsers,
  morpheuTemplates,
  morpheuMessages,
  tenants,
  tenantUsers,
  eq,
  and,
  desc,
  sql,
} from "@matrix-food/database";
import {
  encrypt,
  decrypt,
  isValidE164,
  normalizePhoneE164,
  generateOtpCode,
  hashOtpCode,
  otpExpiresAt,
  isOtpExpired,
  canAttemptOtp,
  OTP_MAX_ATTEMPTS,
  loadMorpheuConfig,
  loadMorpheuConfigRaw,
  testConnection,
  sendTemplate,
  buildTemplateParams,
  MORPHEU_TEMPLATES,
} from "../services/morpheu";

// ============================================================
// SUPERADMIN: config global + templates + auditoria
// ============================================================

const configRouter = createTRPCRouter({
  /** Retorna a config atual (sem expor tokens decriptados). */
  get: superadminProcedure.query(async () => {
    const db = getDb();
    const [row] = await db.select().from(morpheuConfig).limit(1);
    if (!row) {
      return {
        exists: false as const,
      };
    }
    return {
      exists: true as const,
      id: row.id,
      metaAppId: row.metaAppId,
      metaPhoneNumberId: row.metaPhoneNumberId,
      metaBusinessAccountId: row.metaBusinessAccountId,
      graphApiVersion: row.graphApiVersion,
      webhookVerifyToken: row.webhookVerifyToken,
      hasAccessToken: !!row.encryptedAccessToken,
      hasWebhookSecret: !!row.encryptedWebhookSecret,
      displayName: row.displayName,
      defaultSystemPrompt: row.defaultSystemPrompt,
      enabled: row.enabled,
      updatedAt: row.updatedAt,
    };
  }),

  /** Upsert das credenciais e toggles. Tokens são criptografados. */
  update: superadminProcedure
    .input(
      z.object({
        metaAppId: z.string().min(1).optional(),
        accessToken: z.string().min(1).optional(),
        metaPhoneNumberId: z.string().min(1).optional(),
        metaBusinessAccountId: z.string().optional().nullable(),
        graphApiVersion: z.string().min(2).optional(),
        webhookVerifyToken: z.string().min(8).optional(),
        webhookSecret: z.string().min(8).optional(),
        displayName: z.string().min(1).max(50).optional(),
        defaultSystemPrompt: z.string().optional().nullable(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [existing] = await db.select().from(morpheuConfig).limit(1);

      const patch: Record<string, unknown> = {};
      if (input.metaAppId !== undefined) patch.metaAppId = input.metaAppId;
      if (input.accessToken !== undefined)
        patch.encryptedAccessToken = encrypt(input.accessToken);
      if (input.metaPhoneNumberId !== undefined)
        patch.metaPhoneNumberId = input.metaPhoneNumberId;
      if (input.metaBusinessAccountId !== undefined)
        patch.metaBusinessAccountId = input.metaBusinessAccountId;
      if (input.graphApiVersion !== undefined)
        patch.graphApiVersion = input.graphApiVersion;
      if (input.webhookVerifyToken !== undefined)
        patch.webhookVerifyToken = input.webhookVerifyToken;
      if (input.webhookSecret !== undefined)
        patch.encryptedWebhookSecret = encrypt(input.webhookSecret);
      if (input.displayName !== undefined) patch.displayName = input.displayName;
      if (input.defaultSystemPrompt !== undefined)
        patch.defaultSystemPrompt = input.defaultSystemPrompt;
      if (input.enabled !== undefined) patch.enabled = input.enabled;

      if (existing) {
        await db
          .update(morpheuConfig)
          .set(patch)
          .where(eq(morpheuConfig.id, existing.id));
        return { id: existing.id, updated: true };
      }

      // criação inicial: precisa de todos os campos obrigatórios
      if (
        !patch.metaAppId ||
        !patch.encryptedAccessToken ||
        !patch.metaPhoneNumberId ||
        !patch.webhookVerifyToken ||
        !patch.encryptedWebhookSecret
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Campos obrigatórios pra criar a configuração: metaAppId, accessToken, metaPhoneNumberId, webhookVerifyToken, webhookSecret.",
        });
      }
      const [created] = await db
        .insert(morpheuConfig)
        .values(patch as typeof morpheuConfig.$inferInsert)
        .returning();
      return { id: created!.id, updated: false };
    }),

  /** Faz um GET na Graph API pra validar as credenciais. */
  testConnection: superadminProcedure.mutation(async () => {
    const cfg = await loadMorpheuConfigRaw();
    if (!cfg) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Configure as credenciais antes de testar.",
      });
    }
    const result = await testConnection(cfg);
    return result;
  }),
});

const templatesRouter = createTRPCRouter({
  /** Lista templates do banco + merge com especificação local. */
  list: superadminProcedure.query(async () => {
    const db = getDb();
    const rows = await db.select().from(morpheuTemplates);
    const byName = new Map(rows.map((r) => [r.name, r]));
    return Object.values(MORPHEU_TEMPLATES).map((spec) => {
      const row = byName.get(spec.name);
      return {
        name: spec.name,
        category: spec.category,
        language: spec.language,
        body: spec.body,
        placeholders: spec.placeholders,
        status: row?.status ?? "DRAFT",
        metaTemplateId: row?.metaTemplateId ?? null,
        dbId: row?.id ?? null,
      };
    });
  }),

  /**
   * Insere/atualiza a entrada local após aprovação manual do template no Meta.
   */
  upsert: superadminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        status: z.enum([
          "DRAFT",
          "PENDING",
          "APPROVED",
          "REJECTED",
          "PAUSED",
          "DISABLED",
        ]),
        metaTemplateId: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const spec =
        MORPHEU_TEMPLATES[input.name as keyof typeof MORPHEU_TEMPLATES];
      if (!spec) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Template desconhecido: ${input.name}`,
        });
      }
      const db = getDb();
      const [existing] = await db
        .select()
        .from(morpheuTemplates)
        .where(eq(morpheuTemplates.name, input.name))
        .limit(1);
      if (existing) {
        await db
          .update(morpheuTemplates)
          .set({
            status: input.status,
            metaTemplateId: input.metaTemplateId ?? null,
          })
          .where(eq(morpheuTemplates.id, existing.id));
        return { id: existing.id, updated: true };
      }
      const [created] = await db
        .insert(morpheuTemplates)
        .values({
          name: spec.name,
          category: spec.category,
          language: spec.language,
          bodyText: spec.body,
          placeholders: spec.placeholders,
          status: input.status,
          metaTemplateId: input.metaTemplateId ?? null,
        })
        .returning();
      return { id: created!.id, updated: false };
    }),
});

// ============================================================
// TENANT: preferências de notificação
// ============================================================

const settingsRouter = createTRPCRouter({
  get: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const [row] = await db
      .select()
      .from(morpheuTenantSettings)
      .where(eq(morpheuTenantSettings.tenantId, ctx.tenantId))
      .limit(1);
    return row ?? null;
  }),

  upsert: tenantProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        notifyCashOpen: z.boolean().optional(),
        notifyCashDeposit: z.boolean().optional(),
        notifyCashWithdraw: z.boolean().optional(),
        notifyOrderCancel: z.boolean().optional(),
        notifyCashClose: z.boolean().optional(),
        notifyDailySummary: z.boolean().optional(),
        notifyAnomalyAlerts: z.boolean().optional(),
        quietHoursStart: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional(),
        quietHoursEnd: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional(),
        digestModeEnabled: z.boolean().optional(),
        digestWindowStart: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional(),
        digestWindowEnd: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional(),
        digestIntervalMinutes: z.number().int().min(5).max(120).optional(),
        timezone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [existing] = await db
        .select()
        .from(morpheuTenantSettings)
        .where(eq(morpheuTenantSettings.tenantId, ctx.tenantId))
        .limit(1);
      if (existing) {
        await db
          .update(morpheuTenantSettings)
          .set(input)
          .where(eq(morpheuTenantSettings.id, existing.id));
        return { id: existing.id, updated: true };
      }
      const [created] = await db
        .insert(morpheuTenantSettings)
        .values({ tenantId: ctx.tenantId, ...input })
        .returning();
      return { id: created!.id, updated: false };
    }),
});

// ============================================================
// TENANT: usuários autorizados (OWNER + 1 MANAGER opcional)
// ============================================================

function requireOwner(ctx: { user: { role: string | null } }) {
  if (ctx.user.role !== "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas o dono pode gerenciar acessos do Morpheu.",
    });
  }
}

const authorizedUsersRouter = createTRPCRouter({
  /** Lista OWNER + MANAGER (ativo ou inativo). */
  list: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({
        id: morpheuAuthorizedUsers.id,
        tenantUserId: morpheuAuthorizedUsers.tenantUserId,
        role: morpheuAuthorizedUsers.role,
        phoneE164: morpheuAuthorizedUsers.phoneE164,
        phoneVerified: morpheuAuthorizedUsers.phoneVerified,
        phoneVerifiedAt: morpheuAuthorizedUsers.phoneVerifiedAt,
        active: morpheuAuthorizedUsers.active,
        createdAt: morpheuAuthorizedUsers.createdAt,
        tenantUserName: tenantUsers.name,
        tenantUserEmail: tenantUsers.email,
      })
      .from(morpheuAuthorizedUsers)
      .leftJoin(
        tenantUsers,
        eq(morpheuAuthorizedUsers.tenantUserId, tenantUsers.id)
      )
      .where(eq(morpheuAuthorizedUsers.tenantId, ctx.tenantId))
      .orderBy(desc(morpheuAuthorizedUsers.createdAt));
    return rows;
  }),

  /**
   * Garante que há uma linha OWNER ativa pro tenant atual
   * (chamada na primeira abertura da tela de configuração do Morpheu).
   * Idempotente.
   */
  ensureOwner: tenantProcedure.mutation(async ({ ctx }) => {
    requireOwner(ctx);
    const db = getDb();
    const [existing] = await db
      .select()
      .from(morpheuAuthorizedUsers)
      .where(
        and(
          eq(morpheuAuthorizedUsers.tenantId, ctx.tenantId),
          eq(morpheuAuthorizedUsers.role, "OWNER"),
          eq(morpheuAuthorizedUsers.active, true)
        )
      )
      .limit(1);
    if (existing) return { id: existing.id, created: false };
    const [row] = await db
      .insert(morpheuAuthorizedUsers)
      .values({
        tenantId: ctx.tenantId,
        role: "OWNER",
        active: true,
      })
      .returning();
    return { id: row!.id, created: true };
  }),

  /**
   * Designa um tenantUser como MANAGER do Morpheu.
   * Falha se já houver um MANAGER ativo (precisa desativar primeiro).
   */
  setManager: tenantProcedure
    .input(z.object({ tenantUserId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requireOwner(ctx);
      const db = getDb();

      // valida que o tenantUser pertence ao tenant
      const [tu] = await db
        .select()
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.id, input.tenantUserId),
            eq(tenantUsers.tenantId, ctx.tenantId)
          )
        )
        .limit(1);
      if (!tu) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuário não encontrado neste restaurante.",
        });
      }

      // bloqueia se já há manager ativo
      const [activeManager] = await db
        .select()
        .from(morpheuAuthorizedUsers)
        .where(
          and(
            eq(morpheuAuthorizedUsers.tenantId, ctx.tenantId),
            eq(morpheuAuthorizedUsers.role, "MANAGER"),
            eq(morpheuAuthorizedUsers.active, true)
          )
        )
        .limit(1);
      if (activeManager) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Já existe um gerente ativo. Desative o atual antes de designar outro.",
        });
      }

      // reativar linha existente do mesmo user ou criar nova
      const [existing] = await db
        .select()
        .from(morpheuAuthorizedUsers)
        .where(
          and(
            eq(morpheuAuthorizedUsers.tenantId, ctx.tenantId),
            eq(morpheuAuthorizedUsers.tenantUserId, input.tenantUserId),
            eq(morpheuAuthorizedUsers.role, "MANAGER")
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(morpheuAuthorizedUsers)
          .set({ active: true })
          .where(eq(morpheuAuthorizedUsers.id, existing.id));
        return { id: existing.id, reused: true };
      }

      const [created] = await db
        .insert(morpheuAuthorizedUsers)
        .values({
          tenantId: ctx.tenantId,
          tenantUserId: input.tenantUserId,
          role: "MANAGER",
          active: true,
        })
        .returning();
      return { id: created!.id, reused: false };
    }),

  /** Desativa um authorized user (só se for MANAGER — OWNER nunca desativa). */
  deactivate: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requireOwner(ctx);
      const db = getDb();
      const [row] = await db
        .select()
        .from(morpheuAuthorizedUsers)
        .where(
          and(
            eq(morpheuAuthorizedUsers.id, input.id),
            eq(morpheuAuthorizedUsers.tenantId, ctx.tenantId)
          )
        )
        .limit(1);
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (row.role === "OWNER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "O acesso do dono não pode ser desativado.",
        });
      }
      await db
        .update(morpheuAuthorizedUsers)
        .set({ active: false })
        .where(eq(morpheuAuthorizedUsers.id, input.id));
      return { ok: true };
    }),
});

// ============================================================
// TENANT: fluxo do próprio usuário (cadastro de telefone + OTP)
// ============================================================

const meRouter = createTRPCRouter({
  /**
   * Retorna a linha authorizedUser do usuário atual (se houver).
   * Também indica se ele é OWNER ou MANAGER designado.
   */
  get: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();

    // OWNER: linha OWNER do tenant
    if (ctx.user.role === "OWNER") {
      const [row] = await db
        .select()
        .from(morpheuAuthorizedUsers)
        .where(
          and(
            eq(morpheuAuthorizedUsers.tenantId, ctx.tenantId),
            eq(morpheuAuthorizedUsers.role, "OWNER")
          )
        )
        .limit(1);
      return row
        ? {
            id: row.id,
            role: row.role,
            phoneE164: row.phoneE164,
            phoneVerified: row.phoneVerified,
            active: row.active,
          }
        : null;
    }

    // MANAGER/outros: encontra tenantUser pelo uid Firebase, depois linha morpheu
    const [tu] = await db
      .select({ id: tenantUsers.id })
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.tenantId, ctx.tenantId),
          eq(tenantUsers.firebaseUid, ctx.user.uid)
        )
      )
      .limit(1);
    if (!tu) return null;

    const [row] = await db
      .select()
      .from(morpheuAuthorizedUsers)
      .where(
        and(
          eq(morpheuAuthorizedUsers.tenantId, ctx.tenantId),
          eq(morpheuAuthorizedUsers.tenantUserId, tu.id),
          eq(morpheuAuthorizedUsers.active, true)
        )
      )
      .limit(1);
    return row
      ? {
          id: row.id,
          role: row.role,
          phoneE164: row.phoneE164,
          phoneVerified: row.phoneVerified,
          active: row.active,
        }
      : null;
  }),

  /**
   * Registra o telefone e dispara OTP via template `morpheu_otp`.
   * O usuário precisa já ser OWNER ou MANAGER ativo.
   */
  requestOtp: tenantProcedure
    .input(z.object({ phone: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // localiza authorized user do ctx.user
      const authorized = await resolveCurrentAuthorizedUser(
        ctx.tenantId,
        ctx.user.uid,
        ctx.user.role
      );
      if (!authorized) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem acesso ao Morpheu neste restaurante.",
        });
      }

      const phoneE164 = normalizePhoneE164(input.phone);
      if (!phoneE164 || !isValidE164(phoneE164)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Telefone inválido. Use formato com DDD.",
        });
      }

      // impede 2 authorized users com o mesmo telefone (evita confusão no webhook)
      const [clash] = await db
        .select()
        .from(morpheuAuthorizedUsers)
        .where(
          and(
            eq(morpheuAuthorizedUsers.phoneE164, phoneE164),
            eq(morpheuAuthorizedUsers.active, true)
          )
        )
        .limit(1);
      if (clash && clash.id !== authorized.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este telefone já está cadastrado em outro acesso ativo.",
        });
      }

      const code = generateOtpCode();
      const hash = hashOtpCode(code, authorized.id);
      await db
        .update(morpheuAuthorizedUsers)
        .set({
          phoneE164,
          phoneVerified: false,
          phoneVerifiedAt: null,
          otpCodeHash: hash,
          otpExpiresAt: otpExpiresAt(),
          otpAttempts: 0,
        })
        .where(eq(morpheuAuthorizedUsers.id, authorized.id));

      // envia OTP via template
      const cfg = await loadMorpheuConfig();
      if (!cfg) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Morpheu ainda não foi habilitado globalmente. Fale com o suporte Matrix Food.",
        });
      }
      const params = buildTemplateParams("morpheu_otp", { code });
      try {
        const result = await sendTemplate(
          cfg,
          phoneE164,
          "morpheu_otp",
          "pt_BR",
          params
        );
        await db.insert(morpheuMessages).values({
          tenantId: ctx.tenantId,
          authorizedUserId: authorized.id,
          direction: "OUTBOUND",
          messageType: "TEMPLATE",
          templateName: "morpheu_otp",
          body: `OTP enviado para ${phoneE164}`,
          whatsappMessageId: result.whatsappMessageId,
          phoneE164,
          status: "SENT",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await db.insert(morpheuMessages).values({
          tenantId: ctx.tenantId,
          authorizedUserId: authorized.id,
          direction: "OUTBOUND",
          messageType: "TEMPLATE",
          templateName: "morpheu_otp",
          body: `Falha ao enviar OTP: ${msg}`,
          phoneE164,
          status: "FAILED",
          errorMessage: msg,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao enviar o código. Tente novamente em instantes.",
        });
      }

      return { sent: true, phoneE164 };
    }),

  /** Verifica OTP e confirma o telefone. */
  verifyOtp: tenantProcedure
    .input(z.object({ code: z.string().regex(/^\d{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const authorized = await resolveCurrentAuthorizedUser(
        ctx.tenantId,
        ctx.user.uid,
        ctx.user.role
      );
      if (!authorized) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (!authorized.otpCodeHash || !authorized.otpExpiresAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Peça um novo código antes de verificar.",
        });
      }
      if (isOtpExpired(authorized.otpExpiresAt)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Código expirado. Peça outro.",
        });
      }
      if (!canAttemptOtp(authorized.otpAttempts)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Máximo de ${OTP_MAX_ATTEMPTS} tentativas excedido. Peça um novo código.`,
        });
      }

      const expected = hashOtpCode(input.code, authorized.id);
      if (expected !== authorized.otpCodeHash) {
        await db
          .update(morpheuAuthorizedUsers)
          .set({ otpAttempts: (authorized.otpAttempts ?? 0) + 1 })
          .where(eq(morpheuAuthorizedUsers.id, authorized.id));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Código incorreto.",
        });
      }

      await db
        .update(morpheuAuthorizedUsers)
        .set({
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
          otpCodeHash: null,
          otpExpiresAt: null,
          otpAttempts: 0,
        })
        .where(eq(morpheuAuthorizedUsers.id, authorized.id));

      return { ok: true };
    }),

  /** Remove o telefone cadastrado (mantém a autorização ativa, só descadastra o fone). */
  removePhone: tenantProcedure.mutation(async ({ ctx }) => {
    const db = getDb();
    const authorized = await resolveCurrentAuthorizedUser(
      ctx.tenantId,
      ctx.user.uid,
      ctx.user.role
    );
    if (!authorized) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    await db
      .update(morpheuAuthorizedUsers)
      .set({
        phoneE164: null,
        phoneVerified: false,
        phoneVerifiedAt: null,
        otpCodeHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      })
      .where(eq(morpheuAuthorizedUsers.id, authorized.id));
    return { ok: true };
  }),
});

/**
 * Helper interno: encontra (e cria se for OWNER) o authorizedUser do ctx.user atual.
 */
async function resolveCurrentAuthorizedUser(
  tenantId: string,
  uid: string,
  role: string | null
) {
  const db = getDb();

  if (role === "OWNER") {
    const [row] = await db
      .select()
      .from(morpheuAuthorizedUsers)
      .where(
        and(
          eq(morpheuAuthorizedUsers.tenantId, tenantId),
          eq(morpheuAuthorizedUsers.role, "OWNER"),
          eq(morpheuAuthorizedUsers.active, true)
        )
      )
      .limit(1);
    if (row) return row;
    const [created] = await db
      .insert(morpheuAuthorizedUsers)
      .values({ tenantId, role: "OWNER", active: true })
      .returning();
    return created!;
  }

  const [tu] = await db
    .select({ id: tenantUsers.id })
    .from(tenantUsers)
    .where(
      and(
        eq(tenantUsers.tenantId, tenantId),
        eq(tenantUsers.firebaseUid, uid)
      )
    )
    .limit(1);
  if (!tu) return null;

  const [row] = await db
    .select()
    .from(morpheuAuthorizedUsers)
    .where(
      and(
        eq(morpheuAuthorizedUsers.tenantId, tenantId),
        eq(morpheuAuthorizedUsers.tenantUserId, tu.id),
        eq(morpheuAuthorizedUsers.active, true)
      )
    )
    .limit(1);
  return row ?? null;
}

// ============================================================
// TENANT / SUPERADMIN: histórico de mensagens
// ============================================================

const messagesRouter = createTRPCRouter({
  listForTenant: tenantProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(200).default(50) })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const limit = input?.limit ?? 50;
      const rows = await db
        .select()
        .from(morpheuMessages)
        .where(eq(morpheuMessages.tenantId, ctx.tenantId))
        .orderBy(desc(morpheuMessages.createdAt))
        .limit(limit);
      return rows;
    }),

  listAll: superadminProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(500).default(100) })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit ?? 100;
      const rows = await db
        .select({
          id: morpheuMessages.id,
          tenantId: morpheuMessages.tenantId,
          tenantName: tenants.name,
          direction: morpheuMessages.direction,
          messageType: morpheuMessages.messageType,
          templateName: morpheuMessages.templateName,
          phoneE164: morpheuMessages.phoneE164,
          body: morpheuMessages.body,
          status: morpheuMessages.status,
          errorMessage: morpheuMessages.errorMessage,
          createdAt: morpheuMessages.createdAt,
        })
        .from(morpheuMessages)
        .leftJoin(tenants, eq(morpheuMessages.tenantId, tenants.id))
        .orderBy(desc(morpheuMessages.createdAt))
        .limit(limit);
      return rows;
    }),

  stats: superadminProcedure.query(async () => {
    const db = getDb();
    const [totals] = await db
      .select({
        total: sql<number>`count(*)::int`,
        outbound: sql<number>`count(*) filter (where ${morpheuMessages.direction} = 'OUTBOUND')::int`,
        inbound: sql<number>`count(*) filter (where ${morpheuMessages.direction} = 'INBOUND')::int`,
        failed: sql<number>`count(*) filter (where ${morpheuMessages.status} = 'FAILED')::int`,
      })
      .from(morpheuMessages);
    return (
      totals ?? { total: 0, outbound: 0, inbound: 0, failed: 0 }
    );
  }),
});

// ============================================================
// Router raiz Morpheu
// ============================================================

export const morpheuRouter = createTRPCRouter({
  config: configRouter,
  templates: templatesRouter,
  settings: settingsRouter,
  authorizedUsers: authorizedUsersRouter,
  me: meRouter,
  messages: messagesRouter,
});
