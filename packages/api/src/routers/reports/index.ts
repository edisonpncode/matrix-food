import { createTRPCRouter } from "../../trpc";
import { salesReportsRouter } from "./sales";
import { productsReportsRouter } from "./products";
import { cashRegisterReportsRouter } from "./cashRegister";
import { reviewsReportsRouter } from "./reviews";
import { customersReportsRouter } from "./customers";
import { loyaltyReportsRouter } from "./loyalty";
import { operationsReportsRouter } from "./operations";
import { deliveryReportsRouter } from "./delivery";
import { promotionsReportsRouter } from "./promotions";
import { fiscalReportsRouter } from "./fiscal";
import { communicationsReportsRouter } from "./communications";
import { profitabilityReportsRouter } from "./profitability";

/** Router agregador da área de Relatórios — todos os domínios. */
export const reportsRouter = createTRPCRouter({
  sales: salesReportsRouter,
  products: productsReportsRouter,
  cashRegister: cashRegisterReportsRouter,
  reviews: reviewsReportsRouter,
  customers: customersReportsRouter,
  loyalty: loyaltyReportsRouter,
  operations: operationsReportsRouter,
  delivery: deliveryReportsRouter,
  promotions: promotionsReportsRouter,
  fiscal: fiscalReportsRouter,
  communications: communicationsReportsRouter,
  profitability: profitabilityReportsRouter,
});
