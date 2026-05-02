import { createTRPCRouter } from "../../trpc";
import { salesReportsRouter } from "./sales";

/**
 * Router agregador da área de Relatórios.
 *
 * Cada sub-router cobre um domínio (vendas, produtos, clientes, etc).
 * Sub-routers adicionais são introduzidos nas próximas fases:
 *  - products, customers, loyalty, operations, cashRegister,
 *    promotions, delivery, reviews, fiscal, communications.
 */
export const reportsRouter = createTRPCRouter({
  sales: salesReportsRouter,
});
