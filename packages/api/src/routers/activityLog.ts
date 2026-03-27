import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../trpc";
import {
  getDb,
  activityLogs,
  tenantUsers,
  eq,
  and,
  desc,
  gte,
  lte,
} from "@matrix-food/database";

export const activityLogRouter = createTRPCRouter({
  /**
   * Lista logs de atividade do restaurante com paginação e filtros.
   */
  list: tenantProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        userId: z.string().uuid().optional(),
        action: z
          .enum([
            "LOGIN",
            "LOGOUT",
            "ORDER_CREATED",
            "ORDER_CONFIRMED",
            "ORDER_CANCELLED",
            "ORDER_STATUS_CHANGED",
            "CASH_OPENED",
            "CASH_CLOSED",
            "CASH_WITHDRAWAL",
            "PRODUCT_CREATED",
            "PRODUCT_UPDATED",
            "PRODUCT_DELETED",
            "CATEGORY_CREATED",
            "CATEGORY_UPDATED",
            "PROMOTION_CREATED",
            "PROMOTION_UPDATED",
            "SETTINGS_UPDATED",
            "STAFF_CREATED",
            "STAFF_UPDATED",
            "STAFF_DEACTIVATED",
            "USER_TYPE_CREATED",
            "USER_TYPE_UPDATED",
            "USER_TYPE_DELETED",
            "PIN_SWITCH",
          ])
          .optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const conditions = [eq(activityLogs.tenantId, ctx.tenantId)];

      if (input.userId) {
        conditions.push(eq(activityLogs.userId, input.userId));
      }
      if (input.action) {
        conditions.push(eq(activityLogs.action, input.action));
      }
      if (input.dateFrom) {
        conditions.push(gte(activityLogs.createdAt, input.dateFrom));
      }
      if (input.dateTo) {
        conditions.push(lte(activityLogs.createdAt, input.dateTo));
      }

      const logs = await db
        .select({
          id: activityLogs.id,
          userName: activityLogs.userName,
          action: activityLogs.action,
          description: activityLogs.description,
          metadata: activityLogs.metadata,
          createdAt: activityLogs.createdAt,
        })
        .from(activityLogs)
        .where(and(...conditions))
        .orderBy(desc(activityLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return logs;
    }),

  /**
   * Lista funcionários para o filtro de log (dropdown).
   */
  getStaffForFilter: tenantProcedure.query(async ({ ctx }) => {
    return getDb()
      .select({
        id: tenantUsers.id,
        name: tenantUsers.name,
      })
      .from(tenantUsers)
      .where(eq(tenantUsers.tenantId, ctx.tenantId))
      .orderBy(tenantUsers.name);
  }),
});
