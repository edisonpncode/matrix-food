import { createTRPCRouter } from "./trpc";
import { healthRouter } from "./routers/health";
import { tenantRouter } from "./routers/tenant";
import { categoryRouter } from "./routers/category";
import { productRouter } from "./routers/product";
import { orderRouter } from "./routers/order";
import { cashRegisterRouter } from "./routers/cashRegister";
import { promotionRouter } from "./routers/promotion";
import { loyaltyRouter } from "./routers/loyalty";

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
  loyalty: loyaltyRouter,
});

export type AppRouter = typeof appRouter;
