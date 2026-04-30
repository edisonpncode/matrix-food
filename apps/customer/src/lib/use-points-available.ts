"use client";

import { trpc } from "@/lib/trpc";
import { useCartStore } from "@/stores/cart-store";
import { useCustomerAuth } from "@/lib/customer-auth-context";

/**
 * Saldo de pontos disponível para o cliente, descontando o que já está
 * reservado em itens do carrinho pagos com pontos.
 *
 * - `enabled`: true quando o programa de fidelidade está ativo
 * - `balance`: saldo total no banco
 * - `reserved`: pontos já comprometidos em itens do carrinho atual
 * - `available`: balance - reserved (clamp em 0)
 * - `hasCustomer`: cliente identificado por telefone
 */
export function usePointsAvailable(tenantId: string) {
  const { customer } = useCustomerAuth();
  const reserved = useCartStore((s) => s.getPointsToSpend());

  const { data: config } = trpc.loyalty.getPublicConfig.useQuery(
    { tenantId },
    { enabled: !!tenantId }
  );

  const { data: balanceData } = trpc.loyalty.getBalance.useQuery(
    { tenantId, customerPhone: customer?.phone ?? "" },
    { enabled: !!config && !!customer?.phone }
  );

  const balance = balanceData?.balance ?? 0;
  const available = Math.max(0, balance - reserved);

  return {
    enabled: !!config,
    pointsName: balanceData?.pointsName ?? config?.pointsName ?? "Pontos",
    balance,
    reserved,
    available,
    hasCustomer: !!customer?.phone,
  };
}
