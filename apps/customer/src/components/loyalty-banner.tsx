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
              : `Ganhe ${config.pointsPerReal} ${config.pointsName.toLowerCase()} a cada R$1 gasto e troque por produtos!`}
          </p>
        </div>
      </div>
    </div>
  );
}
