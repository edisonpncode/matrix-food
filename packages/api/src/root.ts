import { createTRPCRouter } from "./trpc";
import { healthRouter } from "./routers/health";
import { tenantRouter } from "./routers/tenant";

/**
 * Router raiz que combina todos os sub-routers.
 * Cada novo módulo (products, orders, etc.) será adicionado aqui.
 */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  tenant: tenantRouter,
});

export type AppRouter = typeof appRouter;
