import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import type { AuthUser } from "@matrix-food/auth";

/**
 * Contexto que cada requisição tRPC recebe.
 * Contém dados do usuário autenticado e do tenant (restaurante).
 */
/**
 * Identidade de um cliente (consumidor final) autenticado.
 * Duas variantes coexistem:
 *  - `uid` (Firebase Phone Auth) — usado pelo app cliente legado (apps/customer)
 *  - `customerId` (HMAC cookie apps/web) — login por senha no link de pedidos
 * Pelo menos um deles deve estar presente.
 * Separado de `user` (staff/admin do restaurante) para evitar colisão de sessões.
 */
export interface CustomerAuth {
  uid?: string;
  customerId?: string;
  phone: string | null;
}

export interface TRPCContext {
  user: AuthUser | null;
  tenantId: string | null;
  customer?: CustomerAuth | null;
  /** IP do cliente (best-effort, via x-forwarded-for/x-real-ip). Usado p/ rate limit. */
  ip?: string | null;
}

/**
 * Inicialização do tRPC com superjson para serializar datas e decimais.
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof z.ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Router e procedures exportados.
 */
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Procedure pública - não requer autenticação.
 * Usado para rotas como menu do restaurante (clientes não logados podem ver).
 */
export const publicProcedure = t.procedure;

/**
 * Middleware que verifica se o usuário está autenticado.
 */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user?.uid) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Você precisa estar logado para acessar este recurso.",
    });
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

/**
 * Procedure protegida - requer autenticação.
 */
export const protectedProcedure = t.procedure.use(enforceAuth);

/**
 * Middleware que verifica se o usuário pertence a um tenant (restaurante).
 */
const enforceTenant = t.middleware(({ ctx, next }) => {
  if (!ctx.user?.uid) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Você precisa estar logado.",
    });
  }
  if (!ctx.tenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você não tem acesso a este restaurante.",
    });
  }
  return next({
    ctx: {
      user: ctx.user,
      tenantId: ctx.tenantId,
    },
  });
});

/**
 * Procedure de tenant - requer autenticação E pertencer a um restaurante.
 * Usado para todas as operações dentro de um restaurante.
 */
export const tenantProcedure = t.procedure.use(enforceTenant);

/**
 * Middleware que verifica se há um cliente (consumidor) autenticado.
 * Aceita Firebase uid (apps/customer) ou customerId HMAC (apps/web).
 */
const enforceCustomer = t.middleware(({ ctx, next }) => {
  if (!ctx.customer?.uid && !ctx.customer?.customerId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Você precisa estar logado como cliente.",
    });
  }
  return next({
    ctx: {
      customer: ctx.customer,
    },
  });
});

/**
 * Procedure para o portal do cliente (consumidor final).
 * Requer login via Firebase Phone Auth ou senha (HMAC cookie).
 */
export const customerProcedure = t.procedure.use(enforceCustomer);

/**
 * Middleware que verifica se o usuário é SUPER ADMIN da Matrix Food.
 *
 * Critério (em ordem):
 *  1. uid === "dev-superadmin" (contexto fixo do apps/superadmin em dev)
 *  2. email contido em `SUPERADMIN_EMAILS` (CSV em env, ex: "a@x.com,b@y.com")
 */
const enforceSuperAdmin = t.middleware(({ ctx, next }) => {
  const user = ctx.user;
  if (!user?.uid) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Você precisa estar logado.",
    });
  }

  const allowlist = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const isDevSuperadmin = user.uid === "dev-superadmin";
  const isAllowlisted =
    !!user.email && allowlist.includes(user.email.toLowerCase());

  if (!isDevSuperadmin && !isAllowlisted) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso restrito a superadministradores.",
    });
  }

  return next({ ctx: { user } });
});

/**
 * Procedure de superadmin — somente Matrix Food team.
 * Usada pra config global do Morpheu, auditoria multi-tenant, etc.
 */
export const superadminProcedure = t.procedure.use(enforceSuperAdmin);
