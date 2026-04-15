import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "../trpc";
import {
  getDb,
  tenantUsers,
  userTypes,
  activityLogs,
  eq,
  and,
  asc,
  desc,
} from "@matrix-food/database";

export const staffRouter = createTRPCRouter({
  /**
   * Lista motoboys ativos (role = DELIVERY). Usado pelo DeliveryPersonSelector.
   */
  listDeliveryPeople: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const people = await db
      .select({
        id: tenantUsers.id,
        name: tenantUsers.name,
        phone: tenantUsers.phone,
        photoUrl: tenantUsers.photoUrl,
      })
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.tenantId, ctx.tenantId),
          eq(tenantUsers.role, "DELIVERY"),
          eq(tenantUsers.isActive, true)
        )
      )
      .orderBy(asc(tenantUsers.name));
    return people;
  }),

  /**
   * Lista todos os funcionários do restaurante.
   */
  list: tenantProcedure.query(async ({ ctx }) => {
    const db = getDb();

    const users = await db
      .select({
        id: tenantUsers.id,
        name: tenantUsers.name,
        email: tenantUsers.email,
        phone: tenantUsers.phone,
        role: tenantUsers.role,
        photoUrl: tenantUsers.photoUrl,
        pin: tenantUsers.pin,
        isActive: tenantUsers.isActive,
        userTypeId: tenantUsers.userTypeId,
        createdAt: tenantUsers.createdAt,
        userTypeName: userTypes.name,
      })
      .from(tenantUsers)
      .leftJoin(userTypes, eq(tenantUsers.userTypeId, userTypes.id))
      .where(eq(tenantUsers.tenantId, ctx.tenantId))
      .orderBy(asc(tenantUsers.name));

    return users;
  }),

  /**
   * Busca um funcionário por ID.
   */
  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [user] = await db
        .select({
          id: tenantUsers.id,
          name: tenantUsers.name,
          email: tenantUsers.email,
          phone: tenantUsers.phone,
          role: tenantUsers.role,
          photoUrl: tenantUsers.photoUrl,
          pin: tenantUsers.pin,
          isActive: tenantUsers.isActive,
          userTypeId: tenantUsers.userTypeId,
          firebaseUid: tenantUsers.firebaseUid,
          permissions: tenantUsers.permissions,
          createdAt: tenantUsers.createdAt,
          updatedAt: tenantUsers.updatedAt,
          userTypeName: userTypes.name,
        })
        .from(tenantUsers)
        .leftJoin(userTypes, eq(tenantUsers.userTypeId, userTypes.id))
        .where(
          and(
            eq(tenantUsers.id, input.id),
            eq(tenantUsers.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      return user ?? null;
    }),

  /**
   * Cria um novo funcionário.
   * Login será por email + PIN (não precisa de Firebase UID).
   */
  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        email: z.string().email("Email inválido"),
        phone: z.string().max(20).optional(),
        role: z.enum(["OWNER", "MANAGER", "CASHIER", "DELIVERY"]).optional().default("CASHIER"),
        userTypeId: z.string().uuid().nullable().optional(),
        photoUrl: z.string().url().nullable().optional(),
        pin: z
          .string()
          .regex(/^\d{4,6}$/, "PIN deve ter entre 4 e 6 dígitos"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verificar email duplicado no mesmo tenant
      const [existingEmail] = await db
        .select({ id: tenantUsers.id })
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.tenantId, ctx.tenantId),
            eq(tenantUsers.email, input.email)
          )
        )
        .limit(1);

      if (existingEmail) {
        throw new Error("Já existe um funcionário com este email.");
      }

      // Verificar PIN duplicado no mesmo tenant
      const [existingPin] = await db
        .select({ id: tenantUsers.id })
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.tenantId, ctx.tenantId),
            eq(tenantUsers.pin, input.pin)
          )
        )
        .limit(1);

      if (existingPin) {
        throw new Error("Este PIN já está em uso por outro funcionário.");
      }

      const [created] = await db
        .insert(tenantUsers)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          role: input.role,
          userTypeId: input.userTypeId ?? null,
          photoUrl: input.photoUrl ?? null,
          pin: input.pin,
        })
        .returning();

      // Registrar no log de atividades
      await db.insert(activityLogs).values({
        tenantId: ctx.tenantId,
        userName: "Admin",
        action: "STAFF_CREATED",
        description: `Funcionário "${input.name}" foi adicionado.`,
        metadata: { staffId: created?.id, staffName: input.name },
      });

      return created;
    }),

  /**
   * Atualiza um funcionário.
   */
  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        email: z.string().email().nullable().optional(),
        phone: z.string().max(20).nullable().optional(),
        role: z.enum(["OWNER", "MANAGER", "CASHIER", "DELIVERY"]).optional(),
        userTypeId: z.string().uuid().nullable().optional(),
        photoUrl: z.string().url().nullable().optional(),
        pin: z
          .string()
          .regex(/^\d{4,6}$/, "PIN deve ter entre 4 e 6 dígitos")
          .nullable()
          .optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...data } = input;

      // Verificar PIN duplicado
      if (data.pin) {
        const [existing] = await db
          .select({ id: tenantUsers.id })
          .from(tenantUsers)
          .where(
            and(
              eq(tenantUsers.tenantId, ctx.tenantId),
              eq(tenantUsers.pin, data.pin)
            )
          )
          .limit(1);

        if (existing && existing.id !== id) {
          throw new Error("Este PIN já está em uso por outro funcionário.");
        }
      }

      const [updated] = await db
        .update(tenantUsers)
        .set(data)
        .where(
          and(
            eq(tenantUsers.id, id),
            eq(tenantUsers.tenantId, ctx.tenantId)
          )
        )
        .returning();

      // Log de atividade
      if (data.isActive === false) {
        await db.insert(activityLogs).values({
          tenantId: ctx.tenantId,
          userName: "Admin",
          action: "STAFF_DEACTIVATED",
          description: `Funcionário "${updated?.name}" foi desativado.`,
          metadata: { staffId: id },
        });
      } else {
        await db.insert(activityLogs).values({
          tenantId: ctx.tenantId,
          userName: "Admin",
          action: "STAFF_UPDATED",
          description: `Funcionário "${updated?.name}" foi atualizado.`,
          metadata: { staffId: id },
        });
      }

      return updated;
    }),

  /**
   * Verifica PIN para troca rápida de operador.
   */
  verifyPin: tenantProcedure
    .input(z.object({ pin: z.string().min(4).max(6) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [user] = await db
        .select({
          id: tenantUsers.id,
          name: tenantUsers.name,
          role: tenantUsers.role,
          photoUrl: tenantUsers.photoUrl,
          userTypeId: tenantUsers.userTypeId,
        })
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.tenantId, ctx.tenantId),
            eq(tenantUsers.pin, input.pin),
            eq(tenantUsers.isActive, true)
          )
        )
        .limit(1);

      if (!user) {
        throw new Error("PIN inválido.");
      }

      // Buscar permissões do tipo de usuário
      let permissions: Record<string, boolean> = {};
      if (user.userTypeId) {
        const [userType] = await db
          .select({ permissions: userTypes.permissions })
          .from(userTypes)
          .where(eq(userTypes.id, user.userTypeId))
          .limit(1);

        if (userType) {
          permissions = userType.permissions as Record<string, boolean>;
        }
      }

      // Registrar troca no log
      await db.insert(activityLogs).values({
        tenantId: ctx.tenantId,
        userId: user.id,
        userName: user.name,
        action: "PIN_SWITCH",
        description: `Operador trocado para "${user.name}" via PIN.`,
      });

      return { ...user, permissions };
    }),

  /**
   * Login do funcionário por email + PIN.
   * Retorna dados do funcionário + permissões do tipo de usuário.
   */
  loginByEmailPin: tenantProcedure
    .input(
      z.object({
        email: z.string().email(),
        pin: z.string().min(4).max(6),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [user] = await db
        .select({
          id: tenantUsers.id,
          name: tenantUsers.name,
          email: tenantUsers.email,
          phone: tenantUsers.phone,
          role: tenantUsers.role,
          photoUrl: tenantUsers.photoUrl,
          userTypeId: tenantUsers.userTypeId,
        })
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.tenantId, ctx.tenantId),
            eq(tenantUsers.email, input.email),
            eq(tenantUsers.pin, input.pin),
            eq(tenantUsers.isActive, true)
          )
        )
        .limit(1);

      if (!user) {
        throw new Error("Email ou PIN inválido.");
      }

      // Buscar permissões do tipo de usuário
      let permissions: Record<string, boolean> = {};
      let userTypeName: string | null = null;
      if (user.userTypeId) {
        const [userType] = await db
          .select({
            permissions: userTypes.permissions,
            name: userTypes.name,
          })
          .from(userTypes)
          .where(eq(userTypes.id, user.userTypeId))
          .limit(1);

        if (userType) {
          permissions = userType.permissions as Record<string, boolean>;
          userTypeName = userType.name;
        }
      }

      // Registrar login no log
      await db.insert(activityLogs).values({
        tenantId: ctx.tenantId,
        userId: user.id,
        userName: user.name,
        action: "STAFF_LOGIN",
        description: `"${user.name}" fez login por email+PIN.`,
      });

      return { ...user, permissions, userTypeName };
    }),
});
