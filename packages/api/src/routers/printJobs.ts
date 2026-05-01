import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure } from "../trpc";
import {
  getDb,
  printJobs,
  eq,
  and,
  desc,
  inArray,
  sql,
} from "@matrix-food/database";
import { retryPrintJob } from "../services/print/auto-print";

export const printJobsRouter = createTRPCRouter({
  /**
   * Lista todos os jobs de impressão de um pedido (mais recentes primeiro).
   */
  listByOrder: tenantProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      return db
        .select()
        .from(printJobs)
        .where(
          and(
            eq(printJobs.tenantId, ctx.tenantId),
            eq(printJobs.orderId, input.orderId)
          )
        )
        .orderBy(desc(printJobs.createdAt));
    }),

  /**
   * Retorna a contagem de jobs FAILED por pedido para os pedidos
   * informados. Usada pela UI da lista de pedidos para mostrar um
   * indicador de "impressão falhou" no card.
   */
  failedCountsByOrders: tenantProcedure
    .input(z.object({ orderIds: z.array(z.string().uuid()).max(200) }))
    .query(async ({ ctx, input }) => {
      if (input.orderIds.length === 0) return {} as Record<string, number>;
      const db = getDb();
      const rows = await db
        .select({
          orderId: printJobs.orderId,
          failed: sql<number>`COUNT(*)::int`,
        })
        .from(printJobs)
        .where(
          and(
            eq(printJobs.tenantId, ctx.tenantId),
            inArray(printJobs.orderId, input.orderIds),
            eq(printJobs.status, "FAILED")
          )
        )
        .groupBy(printJobs.orderId);
      const map: Record<string, number> = {};
      for (const r of rows) {
        map[r.orderId] = Number(r.failed);
      }
      return map;
    }),

  /**
   * Tenta novamente uma impressão que falhou.
   */
  retry: tenantProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await retryPrintJob({
          tenantId: ctx.tenantId,
          jobId: input.jobId,
        });
        return result;
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Erro ao reimprimir",
        });
      }
    }),
});
