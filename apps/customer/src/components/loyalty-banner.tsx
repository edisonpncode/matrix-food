"use client";

import { Star } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCustomerAuth } from "@/lib/customer-auth-context";

interface LoyaltyBannerProps {
  tenantId: string;
}

export function LoyaltyBanner({ tenantId }: LoyaltyBannerProps) {
  const { customer } = useCustomerAuth();

  const { data: config } = trpc.loyalty.getPublicConfig.useQuery(
    { tenantId },
    { enabled: !!tenantId }
  );

  const { data: balanceData } = trpc.loyalty.getBalance.useQuery(
    { tenantId, customerPhone: customer?.phone ?? "" },
    { enabled: !!config && !!customer?.phone }
  );

  if (!config) return null;

  const balance = balanceData?.balance ?? 0;
  const pointsName = balanceData?.pointsName ?? config.pointsName;
  const isLoggedWithBalance = !!customer && balance > 0;

  // Constrói descrição da regra de pontos (ex: "1 ponto a cada R$20 gastos")
  const pointsPerBase = parseFloat(config.pointsPerReal);
  const spendingBase = parseFloat(config.spendingBase ?? "1");
  const formattedPoints = Number.isInteger(pointsPerBase)
    ? pointsPerBase.toString()
    : pointsPerBase.toFixed(2).replace(".", ",");
  const formattedBase = Number.isInteger(spendingBase)
    ? spendingBase.toString()
    : spendingBase.toFixed(2).replace(".", ",");
  const pointsLabel = pointsPerBase === 1 ? pointsName.toLowerCase().replace(/s$/, "") : pointsName.toLowerCase();
  const earnRule = `Ganhe ${formattedPoints} ${pointsLabel} a cada R$ ${formattedBase} gasto`;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3">
      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100">
          <Star className="h-5 w-5 text-yellow-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-yellow-800">
            {isLoggedWithBalance
              ? `Você tem ${balance} ${pointsName}`
              : "Programa de Fidelidade"}
          </p>
          <p className="text-xs text-yellow-700">
            {isLoggedWithBalance
              ? `Procure produtos com 🎁 e troque por ${pointsName.toLowerCase()}.`
              : `${earnRule} e troque por produtos!`}
          </p>
        </div>
      </div>
    </div>
  );
}
