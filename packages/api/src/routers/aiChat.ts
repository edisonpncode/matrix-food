import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../trpc";
import {
  getDb,
  aiConversations,
  aiMessages,
  eq,
  and,
  desc,
  asc,
} from "@matrix-food/database";

export const aiChatRouter = createTRPCRouter({
  /**
   * Lista conversas do tenant para a sidebar (ordenadas por updatedAt DESC).
   */
  list: tenantProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional().default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const db = getDb();
      const rows = await db
        .select({
          id: aiConversations.id,
          title: aiConversations.title,
          updatedAt: aiConversations.updatedAt,
          createdAt: aiConversations.createdAt,
        })
        .from(aiConversations)
        .where(eq(aiConversations.tenantId, ctx.tenantId))
        .orderBy(desc(aiConversations.updatedAt))
        .limit(limit);
      return rows;
    }),

  /**
   * Busca uma conversa com todas as mensagens.
   */
  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [conversation] = await db
        .select()
        .from(aiConversations)
        .where(
          and(
            eq(aiConversations.id, input.id),
            eq(aiConversations.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!conversation) return null;

      const msgs = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, input.id))
        .orderBy(asc(aiMessages.createdAt));

      return { ...conversation, messages: msgs };
    }),

  /**
   * Cria uma nova conversa vazia.
   */
  create: tenantProcedure.mutation(async ({ ctx }) => {
    const db = getDb();
    const [conversation] = await db
      .insert(aiConversations)
      .values({ tenantId: ctx.tenantId })
      .returning();
    return conversation!;
  }),

  /**
   * Adiciona uma mensagem a uma conversa existente.
   */
  addMessage: tenantProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        id: z.string(),
        role: z.enum(["user", "assistant"]),
        parts: z.array(z.any()),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Sanitizar file parts (remover data URLs grandes)
      const sanitizedParts = (input.parts as Record<string, unknown>[]).map(
        (part) => {
          if (
            part.type === "file" &&
            typeof part.url === "string" &&
            (part.url as string).startsWith("data:")
          ) {
            return {
              type: "file",
              mediaType: part.mediaType,
              url: null,
              placeholder: true,
            };
          }
          return part;
        }
      );

      await db.insert(aiMessages).values({
        id: input.id,
        conversationId: input.conversationId,
        role: input.role,
        parts: sanitizedParts,
      });

      // Atualizar updatedAt da conversa
      await db
        .update(aiConversations)
        .set({ updatedAt: new Date() })
        .where(eq(aiConversations.id, input.conversationId));

      return { success: true };
    }),

  /**
   * Atualiza o título da conversa.
   */
  updateTitle: tenantProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        title: z.string().max(100),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(aiConversations)
        .set({ title: input.title })
        .where(eq(aiConversations.id, input.conversationId));
      return { success: true };
    }),

  /**
   * Gera título automaticamente com base na primeira mensagem.
   * Usa heurística simples (primeiras palavras) — sem dependência de IA.
   */
  generateTitle: tenantProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        firstMessage: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Extrair palavras significativas (ignorar palavras comuns do português)
      const stopWords = new Set([
        "que", "para", "com", "como", "por", "uma", "uns", "das", "dos",
        "nas", "nos", "não", "mas", "mais", "tem", "são", "foi", "ser",
        "ter", "está", "esse", "essa", "isso", "isto", "este", "esta",
        "quero", "quando", "você", "meu", "minha", "seu", "sua", "ele",
        "ela", "eles", "elas", "nós", "todos", "todas", "pode", "fazer",
        "consegue", "tirar", "colocar", "enviar", "envie", "tire",
      ]);
      const words = input.firstMessage
        .replace(/https?:\/\/\S+/g, "Cardápio Link")
        .replace(/[^\w\sÀ-ú]/g, "")
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()))
        .slice(0, 2);

      const title =
        words.length > 0 ? words.join(" ").slice(0, 50) : "Nova conversa";

      const db = getDb();
      await db
        .update(aiConversations)
        .set({ title })
        .where(eq(aiConversations.id, input.conversationId));

      return { title };
    }),

  /**
   * Deleta uma conversa e todas as suas mensagens.
   */
  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(aiConversations)
        .where(
          and(
            eq(aiConversations.id, input.id),
            eq(aiConversations.tenantId, ctx.tenantId)
          )
        );
      return { success: true };
    }),
});
