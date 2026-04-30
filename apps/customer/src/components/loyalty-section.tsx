"use client";

import { Star } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface LoyaltySectionProps {
  tenantId: string;
  customerPhone: string;
}

export function LoyaltySection({ tenantId, customerPhone }: LoyaltySectionProps) {
  const { data: config } = trpc.loyalty.getPublicConfig.useQuery(
    { tenantId },
    { enabled: !!tenantId }
  );

  const { data: balance } = trpc.loyalty.getBalance.useQuery(
    { tenantId, customerPhone },
    { enabled: !!tenantId && !!customerPhone && customerPhone.length >= 8 }
  );

  if (!config || !customerPhone || customerPhone.length < 8) {
    return null;
  }

  const currentBalance = balance?.balance ?? 0;
  const pointsName = balance?.pointsName ?? config.pointsName;

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 text-yellow-500" />
        <div className="flex-1">
          <h2 className="font-semibold">Programa de Fidelidade</h2>
          <p className="text-xs text-muted-foreground">
            {currentBalance > 0
              ? `Você tem ${currentBalance} ${pointsName}. Resgate produtos no cardápio.`
              : `Faça pedidos para acumular ${pointsName.toLowerCase()} e trocar por produtos.`}
          </p>
        </div>
        {currentBalance > 0 && (
          <span className="rounded-full bg-yellow-50 px-2.5 py-1 text-sm font-semibold text-yellow-700">
            {currentBalance} {pointsName}
          </span>
        )}
      </div>
    </section>
  );
}
