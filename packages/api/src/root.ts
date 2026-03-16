import { createTRPCRouter } from "./trpc";
import { healthRouter } from "./routers/health";
import { tenantRouter } from "./routers/tenant";
import { categoryRouter } from "./routers/category";
import { productRouter } from "./routers/product";
import { orderRouter } from "./routers/order";
import { cashRegisterRouter } from "./routers/cashRegister";
import { promotionRouter } from "./routers/promotion";

/**
 * Router raiz que combina todos os sub-routers.
 */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  tenant: tenantRouter,
  category: categoryRouter,
  product: productRouter,
  order: orderRouter,
  cashRegister: cashRegisterRouter,
  promotion: promotionRouter,
});

export type AppRouter = typeof appRouter;
