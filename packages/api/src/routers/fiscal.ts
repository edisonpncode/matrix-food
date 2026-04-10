import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../trpc";
import {
  getDb,
  fiscalConfigs,
  fiscalDocuments,
  orders,
  orderItems,
  eq,
  and,
  desc,
  sql,
  count,
} from "@matrix-food/database";
import { TRPCError } from "@trpc/server";
import { encrypt, decrypt } from "../services/fiscal/encryption";
import {
  createFiscalProvider,
  type ProviderCredentials,
} from "../services/fiscal/provider";
import { PAYMENT_METHOD_MAP } from "../services/fiscal/types";
import type {
  EmitNfceRequest,
  FiscalItem,
  FiscalPayment,
} from "../services/fiscal/types";

export const fiscalRouter = createTRPCRouter({
  // ================================
  // CONFIGURAÇÃO
  // ================================

  /** Busca config fiscal do restaurante (credenciais mascaradas) */
  getConfig: tenantProcedure.query(async ({ ctx }) => {
    const config = await getDb().query.fiscalConfigs.findFirst({
      where: eq(fiscalConfigs.tenantId, ctx.tenantId!),
    });

    if (!config) return null;

    return {
      ...config,
      // Mascarar credenciais — só mostra provedor e se está configurado
      encryptedCredentials: "***",
      encryptedCsc: config.encryptedCsc ? "***" : null,
      hasCredentials: !!config.encryptedCredentials,
      hasCsc: !!config.encryptedCsc,
    };
  }),

  /** Salvar/atualizar configuração fiscal */
  saveConfig: tenantProcedure
    .input(
      z.object({
        provider: z.enum(["FOCUS_NFE", "WEBMANIA", "NUVEM_FISCAL", "SAFEWEB"]),
        isActive: z.boolean(),
        emissionMode: z.enum(["AUTOMATIC", "MANUAL"]),
        credentials: z.record(z.string()),
        cnpj: z
          .string()
          .min(14)
          .max(18)
          .refine(
            (v) => /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(v),
            "CNPJ inválido"
          ),
        inscricaoEstadual: z.string().optional(),
        razaoSocial: z.string().min(1),
        nomeFantasia: z.string().optional(),
        regimeTributario: z.number().int().min(1).max(3),
        ambiente: z.number().int().min(1).max(2),
        cscId: z.string().optional(),
        csc: z.string().optional(),
        serieNfce: z.number().int().min(1).default(1),
        defaultCfop: z.string().default("5102"),
        defaultCsosn: z.string().default("102"),
        defaultNcm: z.string().default("21069090"),
        logradouro: z.string().optional(),
        numeroEndereco: z.string().optional(),
        bairro: z.string().optional(),
        codigoMunicipio: z.string().optional(),
        municipio: z.string().optional(),
        uf: z.string().max(2).optional(),
        cep: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const tenantId = ctx.tenantId!;

      const encryptedCredentials = encrypt(JSON.stringify(input.credentials));
      const encryptedCsc = input.csc ? encrypt(input.csc) : null;

      const existing = await db.query.fiscalConfigs.findFirst({
        where: eq(fiscalConfigs.tenantId, tenantId),
      });

      const values = {
        tenantId,
        provider: input.provider,
        isActive: input.isActive,
        emissionMode: input.emissionMode,
        encryptedCredentials,
        cnpj: input.cnpj,
        inscricaoEstadual: input.inscricaoEstadual,
        razaoSocial: input.razaoSocial,
        nomeFantasia: input.nomeFantasia,
        regimeTributario: input.regimeTributario,
        ambiente: input.ambiente,
        cscId: input.cscId,
        encryptedCsc,
        serieNfce: input.serieNfce,
        defaultCfop: input.defaultCfop,
        defaultCsosn: input.defaultCsosn,
        defaultNcm: input.defaultNcm,
        logradouro: input.logradouro,
        numeroEndereco: input.numeroEndereco,
        bairro: input.bairro,
        codigoMunicipio: input.codigoMunicipio,
        municipio: input.municipio,
        uf: input.uf,
        cep: input.cep,
      };

      if (existing) {
        const [updated] = await db
          .update(fiscalConfigs)
          .set(values)
          .where(eq(fiscalConfigs.id, existing.id))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(fiscalConfigs)
        .values(values)
        .returning();
      return created;
    }),

  /** Testar conexão com o provedor */
  testConnection: tenantProcedure.mutation(async ({ ctx }) => {
    const config = await getDb().query.fiscalConfigs.findFirst({
      where: eq(fiscalConfigs.tenantId, ctx.tenantId!),
    });

    if (!config) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Configuração fiscal não encontrada. Configure primeiro.",
      });
    }

    try {
      const credentials = JSON.parse(decrypt(config.encryptedCredentials));
      const provider = createFiscalProvider({
        provider: config.provider,
        credentials,
      } as ProviderCredentials);

      // Consultar uma chave inexistente para testar a conexão
      const result = await provider.consultNfce("00000000000000000000000000000000000000000000", config.ambiente);

      // Se retornou not_found, a conexão está funcionando (a nota não existe, mas a API respondeu)
      return {
        success: true,
        message: "Conexão com o provedor estabelecida com sucesso!",
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erro ao conectar com o provedor",
      };
    }
  }),

  // ================================
  // EMISSÃO
  // ================================

  /** Emitir NFC-e para um pedido */
  emit: tenantProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const tenantId = ctx.tenantId!;

      // 1. Validar pedido
      const order = await db.query.orders.findFirst({
        where: and(
          eq(orders.id, input.orderId),
          eq(orders.tenantId, tenantId)
        ),
        with: { items: true },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido não encontrado",
        });
      }

      if (order.paymentStatus !== "PAID") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pedido ainda não foi pago",
        });
      }

      // 2. Verificar se já existe NFC-e autorizada
      const existingDoc = await db.query.fiscalDocuments.findFirst({
        where: and(
          eq(fiscalDocuments.orderId, input.orderId),
          eq(fiscalDocuments.status, "AUTHORIZED")
        ),
      });

      if (existingDoc) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe uma NFC-e autorizada para este pedido",
        });
      }

      // 3. Carregar config fiscal
      const config = await db.query.fiscalConfigs.findFirst({
        where: and(
          eq(fiscalConfigs.tenantId, tenantId),
          eq(fiscalConfigs.isActive, true)
        ),
      });

      if (!config) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Configuração fiscal não encontrada ou inativa. Configure em Nota Fiscal > Configuração.",
        });
      }

      // 4. Decriptar credenciais
      const credentials = JSON.parse(decrypt(config.encryptedCredentials));
      const csc = config.encryptedCsc ? decrypt(config.encryptedCsc) : "";

      // 5. Montar request
      const fiscalItems: FiscalItem[] = (order.items || []).map((item) => ({
        description: item.productName,
        ncm: config.defaultNcm,
        cfop: config.defaultCfop,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        csosn: config.defaultCsosn,
      }));

      const fiscalPayments: FiscalPayment[] = [
        {
          method: PAYMENT_METHOD_MAP[order.paymentMethod] || "99",
          amount: Number(order.total),
        },
      ];

      const emitRequest: EmitNfceRequest = {
        emitter: {
          cnpj: config.cnpj,
          inscricaoEstadual: config.inscricaoEstadual || undefined,
          razaoSocial: config.razaoSocial,
          nomeFantasia: config.nomeFantasia || undefined,
          regimeTributario: config.regimeTributario,
          endereco: {
            logradouro: config.logradouro || "",
            numero: config.numeroEndereco || "",
            bairro: config.bairro || "",
            codigoMunicipio: config.codigoMunicipio || "",
            municipio: config.municipio || "",
            uf: config.uf || "",
            cep: config.cep || "",
          },
        },
        recipient: {},
        items: fiscalItems,
        payments: fiscalPayments,
        totalAmount: Number(order.total),
        discount: Number(order.discount || 0),
        numero: config.proximoNumeroNfce,
        serie: config.serieNfce,
        ambiente: config.ambiente,
        cscId: config.cscId || "",
        csc,
      };

      // 6. Inserir documento
      const [doc] = await db
        .insert(fiscalDocuments)
        .values({
          tenantId,
          orderId: input.orderId,
          status: "PROCESSING",
          provider: config.provider,
          numeroNfce: config.proximoNumeroNfce,
          serieNfce: config.serieNfce,
          lastAttemptAt: new Date(),
        })
        .returning();

      if (!doc) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar documento fiscal",
        });
      }

      // 7. Emitir
      const provider = createFiscalProvider({
        provider: config.provider,
        credentials,
      } as ProviderCredentials);

      const result = await provider.emitNfce(emitRequest);

      // 8. Atualizar documento
      if (result.success) {
        const [updated] = await db
          .update(fiscalDocuments)
          .set({
            status: "AUTHORIZED",
            chaveAcesso: result.chaveAcesso,
            protocolo: result.protocolo,
            danfeUrl: result.danfeUrl,
            xmlUrl: result.xmlUrl,
            providerResponse: result.rawResponse,
          })
          .where(eq(fiscalDocuments.id, doc.id))
          .returning();

        // Incrementar número
        await db
          .update(fiscalConfigs)
          .set({ proximoNumeroNfce: config.proximoNumeroNfce + 1 })
          .where(eq(fiscalConfigs.id, config.id));

        return updated;
      }

      // Falhou
      const [updated] = await db
        .update(fiscalDocuments)
        .set({
          status: result.errorCode === "NETWORK_ERROR" ? "ERROR" : "REJECTED",
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          retryCount: 1,
          nextRetryAt:
            result.errorCode === "NETWORK_ERROR"
              ? new Date(Date.now() + 60_000)
              : null,
          providerResponse: result.rawResponse,
        })
        .where(eq(fiscalDocuments.id, doc.id))
        .returning();

      return updated;
    }),

  /** Cancelar NFC-e autorizada */
  cancel: tenantProcedure
    .input(
      z.object({
        documentId: z.string().uuid(),
        justificativa: z
          .string()
          .min(15, "Justificativa deve ter no mínimo 15 caracteres")
          .max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const doc = await db.query.fiscalDocuments.findFirst({
        where: and(
          eq(fiscalDocuments.id, input.documentId),
          eq(fiscalDocuments.tenantId, ctx.tenantId!)
        ),
      });

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Documento fiscal não encontrado",
        });
      }

      if (doc.status !== "AUTHORIZED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Somente documentos autorizados podem ser cancelados",
        });
      }

      if (!doc.chaveAcesso || !doc.protocolo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Documento sem chave de acesso ou protocolo",
        });
      }

      const config = await db.query.fiscalConfigs.findFirst({
        where: eq(fiscalConfigs.tenantId, ctx.tenantId!),
      });

      if (!config) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Configuração fiscal não encontrada",
        });
      }

      const credentials = JSON.parse(decrypt(config.encryptedCredentials));
      const provider = createFiscalProvider({
        provider: config.provider,
        credentials,
      } as ProviderCredentials);

      const result = await provider.cancelNfce({
        chaveAcesso: doc.chaveAcesso,
        protocolo: doc.protocolo,
        justificativa: input.justificativa,
        ambiente: config.ambiente,
      });

      if (result.success) {
        const [updated] = await db
          .update(fiscalDocuments)
          .set({
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelProtocolo: result.protocolo,
            cancelReason: input.justificativa,
            providerResponse: result.rawResponse,
          })
          .where(eq(fiscalDocuments.id, doc.id))
          .returning();
        return updated;
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: result.errorMessage || "Erro ao cancelar NFC-e",
      });
    }),

  /** Reenviar documento com erro */
  retry: tenantProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const doc = await db.query.fiscalDocuments.findFirst({
        where: and(
          eq(fiscalDocuments.id, input.documentId),
          eq(fiscalDocuments.tenantId, ctx.tenantId!)
        ),
      });

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Documento fiscal não encontrado",
        });
      }

      if (doc.status !== "ERROR" && doc.status !== "REJECTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Somente documentos com erro ou rejeitados podem ser reenviados",
        });
      }

      if (doc.retryCount >= 5) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Número máximo de tentativas atingido (5). Verifique a configuração.",
        });
      }

      // Resetar para PENDING e re-emitir
      await db
        .update(fiscalDocuments)
        .set({
          status: "PROCESSING",
          errorCode: null,
          errorMessage: null,
          lastAttemptAt: new Date(),
          retryCount: doc.retryCount + 1,
        })
        .where(eq(fiscalDocuments.id, doc.id));

      // Buscar config e re-emitir
      const config = await db.query.fiscalConfigs.findFirst({
        where: eq(fiscalConfigs.tenantId, ctx.tenantId!),
      });

      if (!config) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Configuração fiscal não encontrada",
        });
      }

      const order = await db.query.orders.findFirst({
        where: eq(orders.id, doc.orderId),
        with: { items: true },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido não encontrado",
        });
      }

      const credentials = JSON.parse(decrypt(config.encryptedCredentials));
      const csc = config.encryptedCsc ? decrypt(config.encryptedCsc) : "";

      const fiscalItems: FiscalItem[] = (order.items || []).map((item) => ({
        description: item.productName,
        ncm: config.defaultNcm,
        cfop: config.defaultCfop,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        csosn: config.defaultCsosn,
      }));

      const fiscalPayments: FiscalPayment[] = [
        {
          method: PAYMENT_METHOD_MAP[order.paymentMethod] || "99",
          amount: Number(order.total),
        },
      ];

      const emitRequest: EmitNfceRequest = {
        emitter: {
          cnpj: config.cnpj,
          inscricaoEstadual: config.inscricaoEstadual || undefined,
          razaoSocial: config.razaoSocial,
          nomeFantasia: config.nomeFantasia || undefined,
          regimeTributario: config.regimeTributario,
          endereco: {
            logradouro: config.logradouro || "",
            numero: config.numeroEndereco || "",
            bairro: config.bairro || "",
            codigoMunicipio: config.codigoMunicipio || "",
            municipio: config.municipio || "",
            uf: config.uf || "",
            cep: config.cep || "",
          },
        },
        recipient: {},
        items: fiscalItems,
        payments: fiscalPayments,
        totalAmount: Number(order.total),
        discount: Number(order.discount || 0),
        numero: doc.numeroNfce || config.proximoNumeroNfce,
        serie: doc.serieNfce || config.serieNfce,
        ambiente: config.ambiente,
        cscId: config.cscId || "",
        csc,
      };

      const provider = createFiscalProvider({
        provider: config.provider,
        credentials,
      } as ProviderCredentials);

      const result = await provider.emitNfce(emitRequest);

      if (result.success) {
        const [updated] = await db
          .update(fiscalDocuments)
          .set({
            status: "AUTHORIZED",
            chaveAcesso: result.chaveAcesso,
            protocolo: result.protocolo,
            danfeUrl: result.danfeUrl,
            xmlUrl: result.xmlUrl,
            providerResponse: result.rawResponse,
          })
          .where(eq(fiscalDocuments.id, doc.id))
          .returning();
        return updated;
      }

      const backoffMs = [60_000, 300_000, 900_000, 3_600_000, 3_600_000];
      const [updated] = await db
        .update(fiscalDocuments)
        .set({
          status: result.errorCode === "NETWORK_ERROR" ? "ERROR" : "REJECTED",
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          nextRetryAt:
            result.errorCode === "NETWORK_ERROR"
              ? new Date(Date.now() + (backoffMs[doc.retryCount] || 3_600_000))
              : null,
          providerResponse: result.rawResponse,
        })
        .where(eq(fiscalDocuments.id, doc.id))
        .returning();

      return updated;
    }),

  // ================================
  // CONSULTAS
  // ================================

  /** Documentos fiscais de um pedido */
  getByOrder: tenantProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      return db
        .select()
        .from(fiscalDocuments)
        .where(
          and(
            eq(fiscalDocuments.orderId, input.orderId),
            eq(fiscalDocuments.tenantId, ctx.tenantId!)
          )
        )
        .orderBy(desc(fiscalDocuments.createdAt));
    }),

  /** Lista paginada de documentos fiscais */
  list: tenantProcedure
    .input(
      z.object({
        status: z
          .enum([
            "PENDING",
            "PROCESSING",
            "AUTHORIZED",
            "REJECTED",
            "CANCELLED",
            "ERROR",
          ])
          .optional(),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.perPage;

      const conditions = [eq(fiscalDocuments.tenantId, ctx.tenantId!)];
      if (input.status) {
        conditions.push(eq(fiscalDocuments.status, input.status));
      }

      const whereClause = and(...conditions);

      const [docs, totalResult] = await Promise.all([
        db
          .select()
          .from(fiscalDocuments)
          .where(whereClause)
          .orderBy(desc(fiscalDocuments.createdAt))
          .limit(input.perPage)
          .offset(offset),
        db
          .select({ total: count() })
          .from(fiscalDocuments)
          .where(whereClause),
      ]);

      return {
        documents: docs,
        total: totalResult[0]?.total || 0,
        page: input.page,
        perPage: input.perPage,
        totalPages: Math.ceil((totalResult[0]?.total || 0) / input.perPage),
      };
    }),

  /** Estatísticas fiscais */
  getStats: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const tenantId = ctx.tenantId!;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = await db
      .select({
        status: fiscalDocuments.status,
        total: count(),
      })
      .from(fiscalDocuments)
      .where(eq(fiscalDocuments.tenantId, tenantId))
      .groupBy(fiscalDocuments.status);

    const todayResults = await db
      .select({ total: count() })
      .from(fiscalDocuments)
      .where(
        and(
          eq(fiscalDocuments.tenantId, tenantId),
          eq(fiscalDocuments.status, "AUTHORIZED"),
          sql`${fiscalDocuments.createdAt} >= ${today}`
        )
      );

    const byStatus = Object.fromEntries(
      results.map((r) => [r.status, r.total])
    );

    return {
      authorized: byStatus.AUTHORIZED || 0,
      rejected: byStatus.REJECTED || 0,
      pending: (byStatus.PENDING || 0) + (byStatus.PROCESSING || 0),
      error: byStatus.ERROR || 0,
      cancelled: byStatus.CANCELLED || 0,
      authorizedToday: todayResults[0]?.total || 0,
    };
  }),
});
