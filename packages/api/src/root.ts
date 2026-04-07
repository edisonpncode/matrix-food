import { createTRPCRouter } from "./trpc";
import { healthRouter } from "./routers/health";
import { tenantRouter } from "./routers/tenant";
import { categoryRouter } from "./routers/category";
import { productRouter } from "./routers/product";
import { orderRouter } from "./routers/order";
import { cashRegisterRouter } from "./routers/cashRegister";
import { promotionRouter } from "./routers/promotion";
import { loyaltyRouter } from "./routers/loyalty";
import { analyticsRouter } from "./routers/analytics";
import { reviewRouter } from "./routers/review";
import { superadminRouter } from "./routers/superadmin";
import { billingRouter } from "./routers/billing";
import { userTypeRouter } from "./routers/userType";
import { staffRouter } from "./routers/staff";
import { activityLogRouter } from "./routers/activityLog";
import { customerRouter } from "./routers/customer";
import { customerPortalRouter } from "./routers/customer-portal";
import { deliveryAreaRouter } from "./routers/deliveryArea";
import { printRouter } from "./routers/print";
import { minimaxRouter } from "./routers/minimax";
import { ingredientRouter } from "./routers/ingredient";
import { aiChatRouter } from "./routers/aiChat";

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
  analytics: analyticsRouter,
  review: reviewRouter,
  superadmin: superadminRouter,
  billing: billingRouter,
  userType: userTypeRouter,
  staff: staffRouter,
  activityLog: activityLogRouter,
  customer: customerRouter,
  customerPortal: customerPortalRouter,
  deliveryArea: deliveryAreaRouter,
  print: printRouter,
  minimax: minimaxRouter,
  ingredient: ingredientRouter,
  aiChat: aiChatRouter,
});

export type AppRouter = typeof appRouter;
