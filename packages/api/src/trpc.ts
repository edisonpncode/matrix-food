import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import type { AuthUser } from "@matrix-food/auth";

/**
 * Contexto que cada requisição tRPC recebe.
 * Contém dados do usuário autenticado e do tenant (restaurante).
 */
/**
 * Identidade de um cliente (consumidor final) autenticado via Firebase Phone Auth.
 * Separado de `user` (staff/admin do restaurante) para evitar colisão de sessões.
 */
export interface CustomerAuth {
  uid: string;
  phone: string | null;
}

export interface TRPCContext {
  user: AuthUser | null;
  tenantId: string | null;
  customer?: CustomerAuth | null;
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
 * Middleware que verifica se há um cliente (consumidor) autenticado via Firebase Phone Auth.
 */
const enforceCustomer = t.middleware(({ ctx, next }) => {
  if (!ctx.customer?.uid) {
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
 * Requer login via Firebase Phone Auth.
 */
export const customerProcedure = t.procedure.use(enforceCustomer);
