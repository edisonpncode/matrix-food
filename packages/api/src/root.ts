import { createTRPCRouter } from "./trpc";
import { healthRouter } from "./routers/health";
import { tenantRouter } from "./routers/tenant";
import { categoryRouter } from "./routers/category";
import { productRouter } from "./routers/product";
import { orderRouter } from "./routers/order";

/**
 * Router raiz que combina todos os sub-routers.
 * Cada novo módulo (orders, promotions, etc.) será adicionado aqui.
 */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  tenant: tenantRouter,
  category: categoryRouter,
  product: productRouter,
  order: orderRouter,
});

export type AppRouter = typeof appRouter;
