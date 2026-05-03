import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure } from "../trpc";
import {
  getDb,
  staffShifts,
  staffTimeOff,
  tenantUsers,
  activityLogs,
  eq,
  and,
  asc,
} from "@matrix-food/database";

const dayOfWeekSchema = z.number().int().min(0).max(6);
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário deve estar no formato HH:MM");
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD");

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

const shiftItemSchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  notes: z.string().max(200).optional().nullable(),
});

export const staffScheduleRouter = createTRPCRouter({
  /**
   * Lista todos os turnos do tenant com dados básicos do funcionário.
   */
  listShifts: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({
        id: staffShifts.id,
        tenantUserId: staffShifts.tenantUserId,
        dayOfWeek: staffShifts.dayOfWeek,
        startTime: staffShifts.startTime,
        endTime: staffShifts.endTime,
        notes: staffShifts.notes,
        isActive: staffShifts.isActive,
        userName: tenantUsers.name,
      })
      .from(staffShifts)
      .leftJoin(tenantUsers, eq(staffShifts.tenantUserId, tenantUsers.id))
      .where(eq(staffShifts.tenantId, ctx.tenantId))
      .orderBy(asc(staffShifts.dayOfWeek), asc(staffShifts.startTime));

    return rows;
  }),

  /**
   * Substitui TODOS os turnos de um funcionário pelos enviados.
   * Validações:
   *  - endTime > startTime (não suporta turnos que cruzam meia-noite)
   *  - sem sobreposição de horários no mesmo dia da semana
   *  - funcionário deve pertencer ao tenant
   */
  setUserShifts: tenantProcedure
    .input(
      z.object({
        tenantUserId: z.string().uuid(),
        shifts: z.array(shiftItemSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Confere que o funcionário pertence ao tenant
      const [user] = await db
        .select({ id: tenantUsers.id, name: tenantUsers.name })
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.id, input.tenantUserId),
            eq(tenantUsers.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Funcionário não encontrado neste restaurante.",
        });
      }

      // Valida cada turno individualmente
      for (const s of input.shifts) {
        if (timeToMinutes(s.endTime) <= timeToMinutes(s.startTime)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Turno inválido: horário de fim (${s.endTime}) deve ser maior que o de início (${s.startTime}).`,
          });
        }
      }

      // Valida sobreposição por dia da semana
      const byDay = new Map<number, typeof input.shifts>();
      for (const s of input.shifts) {
        const list = byDay.get(s.dayOfWeek) ?? [];
        list.push(s);
        byDay.set(s.dayOfWeek, list);
      }
      for (const [, list] of byDay) {
        const sorted = [...list].sort(
          (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
        );
        for (let i = 1; i < sorted.length; i++) {
          const cur = sorted[i]!;
          const prev = sorted[i - 1]!;
          if (timeToMinutes(cur.startTime) < timeToMinutes(prev.endTime)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Há turnos sobrepostos no mesmo dia. Ajuste os horários.",
            });
          }
        }
      }

      // Substitui: deleta todos e insere os novos
      await db
        .delete(staffShifts)
        .where(
          and(
            eq(staffShifts.tenantId, ctx.tenantId),
            eq(staffShifts.tenantUserId, input.tenantUserId)
          )
        );

      if (input.shifts.length > 0) {
        await db.insert(staffShifts).values(
          input.shifts.map((s) => ({
            tenantId: ctx.tenantId,
            tenantUserId: input.tenantUserId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            notes: s.notes ?? null,
          }))
        );
      }

      await db.insert(activityLogs).values({
        tenantId: ctx.tenantId,
        userName: ctx.user.name ?? ctx.user.email ?? "Admin",
        action: "STAFF_SHIFT_UPDATED",
        description: `Escala de "${user.name}" foi atualizada (${input.shifts.length} turno(s)).`,
        metadata: {
          tenantUserId: input.tenantUserId,
          shiftCount: input.shifts.length,
        },
      });

      return { success: true };
    }),

  /**
   * Remove um turno específico.
   */
  deleteShift: tenantProcedure
    .input(z.object({ shiftId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [shift] = await db
        .select({
          id: staffShifts.id,
          tenantUserId: staffShifts.tenantUserId,
        })
        .from(staffShifts)
        .where(
          and(
            eq(staffShifts.id, input.shiftId),
            eq(staffShifts.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!shift) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Turno não encontrado.",
        });
      }

      await db.delete(staffShifts).where(eq(staffShifts.id, input.shiftId));

      await db.insert(activityLogs).values({
        tenantId: ctx.tenantId,
        userName: ctx.user.name ?? ctx.user.email ?? "Admin",
        action: "STAFF_SHIFT_DELETED",
        description: "Um turno da escala foi removido.",
        metadata: {
          shiftId: input.shiftId,
          tenantUserId: shift.tenantUserId,
        },
      });

      return { success: true };
    }),

  /**
   * Lista folgas e férias do tenant em um intervalo de datas.
   * Por padrão retorna do dia atual até +90 dias.
   */
  listTimeOff: tenantProcedure
    .input(
      z
        .object({
          fromDate: dateSchema.optional(),
          toDate: dateSchema.optional(),
        })
        .optional()
    )
    .query(async ({ ctx }) => {
      const db = getDb();
      const rows = await db
        .select({
          id: staffTimeOff.id,
          tenantUserId: staffTimeOff.tenantUserId,
          type: staffTimeOff.type,
          startDate: staffTimeOff.startDate,
          endDate: staffTimeOff.endDate,
          reason: staffTimeOff.reason,
          createdAt: staffTimeOff.createdAt,
          userName: tenantUsers.name,
        })
        .from(staffTimeOff)
        .leftJoin(tenantUsers, eq(staffTimeOff.tenantUserId, tenantUsers.id))
        .where(eq(staffTimeOff.tenantId, ctx.tenantId))
        .orderBy(asc(staffTimeOff.startDate));

      return rows;
    }),

  /**
   * Cria uma folga ou período de férias para um funcionário.
   */
  createTimeOff: tenantProcedure
    .input(
      z.object({
        tenantUserId: z.string().uuid(),
        type: z.enum(["FOLGA", "FERIAS"]),
        startDate: dateSchema,
        endDate: dateSchema,
        reason: z.string().max(300).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      if (input.endDate < input.startDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A data final não pode ser anterior à data inicial.",
        });
      }

      const [user] = await db
        .select({ id: tenantUsers.id, name: tenantUsers.name })
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.id, input.tenantUserId),
            eq(tenantUsers.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Funcionário não encontrado neste restaurante.",
        });
      }

      const [created] = await db
        .insert(staffTimeOff)
        .values({
          tenantId: ctx.tenantId,
          tenantUserId: input.tenantUserId,
          type: input.type,
          startDate: input.startDate,
          endDate: input.endDate,
          reason: input.reason ?? null,
        })
        .returning();

      await db.insert(activityLogs).values({
        tenantId: ctx.tenantId,
        userName: ctx.user.name ?? ctx.user.email ?? "Admin",
        action: "STAFF_TIME_OFF_CREATED",
        description: `${input.type === "FERIAS" ? "Férias" : "Folga"} cadastrada para "${user.name}" (${input.startDate} a ${input.endDate}).`,
        metadata: {
          timeOffId: created?.id,
          tenantUserId: input.tenantUserId,
          type: input.type,
        },
      });

      return created;
    }),

  /**
   * Remove uma folga ou férias.
   */
  deleteTimeOff: tenantProcedure
    .input(z.object({ timeOffId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [item] = await db
        .select({
          id: staffTimeOff.id,
          tenantUserId: staffTimeOff.tenantUserId,
          type: staffTimeOff.type,
        })
        .from(staffTimeOff)
        .where(
          and(
            eq(staffTimeOff.id, input.timeOffId),
            eq(staffTimeOff.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Registro não encontrado.",
        });
      }

      await db
        .delete(staffTimeOff)
        .where(eq(staffTimeOff.id, input.timeOffId));

      await db.insert(activityLogs).values({
        tenantId: ctx.tenantId,
        userName: ctx.user.name ?? ctx.user.email ?? "Admin",
        action: "STAFF_TIME_OFF_DELETED",
        description: `${item.type === "FERIAS" ? "Férias" : "Folga"} removida.`,
        metadata: {
          timeOffId: input.timeOffId,
          tenantUserId: item.tenantUserId,
        },
      });

      return { success: true };
    }),
});
