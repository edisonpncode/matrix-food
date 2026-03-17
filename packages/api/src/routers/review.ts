import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, tenantProcedure } from "../trpc";
import {
  getDb,
  reviews,
  orders,
  eq,
  and,
  desc,
  sql,
} from "@matrix-food/database";

export const reviewRouter = createTRPCRouter({
  /** Criar avaliação (cliente, público) */
  create: publicProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        tenantId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(1000).optional(),
        customerName: z.string().max(255).optional(),
        customerPhone: z.string().max(20).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Verificar se o pedido existe e pertence ao tenant
      const [order] = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, input.orderId),
            eq(orders.tenantId, input.tenantId)
          )
        )
        .limit(1);

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido não encontrado",
        });
      }

      // Verificar se já existe avaliação para este pedido
      const [existing] = await db
        .select()
        .from(reviews)
        .where(eq(reviews.orderId, input.orderId))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Este pedido já foi avaliado",
        });
      }

      const [review] = await db
        .insert(reviews)
        .values({
          tenantId: input.tenantId,
          orderId: input.orderId,
          rating: input.rating,
          comment: input.comment,
          customerName: input.customerName ?? order.customerName,
          customerPhone: input.customerPhone ?? order.customerPhone,
        })
        .returning();

      return review;
    }),

  /** Listar avaliações do restaurante (admin) */
  listByTenant: tenantProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();

      return db
        .select({
          id: reviews.id,
          orderId: reviews.orderId,
          rating: reviews.rating,
          comment: reviews.comment,
          customerName: reviews.customerName,
          reply: reviews.reply,
          repliedAt: reviews.repliedAt,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .where(eq(reviews.tenantId, ctx.tenantId))
        .orderBy(desc(reviews.createdAt))
        .limit(input.limit);
    }),

  /** Responder avaliação (admin) */
  reply: tenantProcedure
    .input(
      z.object({
        reviewId: z.string().uuid(),
        reply: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await getDb()
        .update(reviews)
        .set({
          reply: input.reply,
          repliedAt: new Date(),
        })
        .where(
          and(
            eq(reviews.id, input.reviewId),
            eq(reviews.tenantId, ctx.tenantId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Avaliação não encontrada",
        });
      }
      return updated;
    }),

  /** Avaliações públicas de um restaurante */
  listPublic: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        limit: z.number().int().min(1).max(20).default(10),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();

      return db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          comment: reviews.comment,
          customerName: reviews.customerName,
          reply: reviews.reply,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .where(eq(reviews.tenantId, input.tenantId))
        .orderBy(desc(reviews.createdAt))
        .limit(input.limit);
    }),

  /** Média de avaliações de um restaurante (público) */
  getAverage: publicProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = getDb();

      const [result] = await db
        .select({
          avg: sql<number>`COALESCE(AVG(${reviews.rating}), 0)::numeric`,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(eq(reviews.tenantId, input.tenantId));

      return {
        average: Math.round(Number(result?.avg ?? 0) * 10) / 10,
        count: result?.count ?? 0,
      };
    }),
});
