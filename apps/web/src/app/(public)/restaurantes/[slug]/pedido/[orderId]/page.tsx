"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Clock, ArrowLeft, Package, Bike, MapPin, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import { ReviewForm } from "@/components/customer/review-form";

interface PageProps {
  params: Promise<{ slug: string; orderId: string }>;
}

const TERMINAL_STATUSES = ["DELIVERED", "PICKED_UP", "CANCELLED"];

const STATUS_STEPS = [
  { key: "PENDING", label: "Pendente", icon: Clock },
  { key: "CONFIRMED", label: "Confirmado", icon: CheckCircle },
  { key: "PREPARING", label: "Em preparo", icon: Package },
  { key: "READY", label: "Pronto", icon: CheckCircle },
  { key: "OUT_FOR_DELIVERY", label: "Saiu para entrega", icon: Bike },
  { key: "DELIVERED", label: "Entregue", icon: MapPin },
];

const PICKUP_STEPS = [
  { key: "PENDING", label: "Pendente", icon: Clock },
  { key: "CONFIRMED", label: "Confirmado", icon: CheckCircle },
  { key: "PREPARING", label: "Em preparo", icon: Package },
  { key: "READY", label: "Pronto para retirada", icon: CheckCircle },
  { key: "PICKED_UP", label: "Retirado", icon: MapPin },
];

function getStepIndex(status: string, steps: typeof STATUS_STEPS): number {
  return steps.findIndex((s) => s.key === status);
}

export default function OrderConfirmationPage({ params }: PageProps) {
  const { slug, orderId } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get("t") ?? "";

  const { data: order, isLoading } = trpc.order.getById.useQuery(
    { id: orderId, token },
    {
      enabled: token.length > 0,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status && TERMINAL_STATUSES.includes(status)) return false;
        return 10000; // 10s polling
      },
    }
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-xl font-bold">Pedido nao encontrado</h1>
        <Link
          href={`/restaurantes/${slug}`}
          className="text-primary hover:underline"
        >
          Voltar ao cardapio
        </Link>
      </div>
    );
  }

  const isCancelled = order.status === "CANCELLED";
  const isPickup = order.type === "PICKUP";
  const steps = isPickup ? PICKUP_STEPS : STATUS_STEPS;
  const currentStepIndex = getStepIndex(order.status, steps);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link href={`/restaurantes/${slug}`} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold">Pedido {order.displayNumber}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Sucesso */}
        <div className="flex flex-col items-center rounded-xl bg-white p-6 text-center shadow-sm">
          {isCancelled ? (
            <XCircle className="h-16 w-16 text-red-500" />
          ) : (
            <CheckCircle className="h-16 w-16 text-green-500" />
          )}
          <h2 className="mt-4 text-2xl font-bold">
            {isCancelled ? "Pedido cancelado" : "Pedido enviado!"}
          </h2>
          <p className="mt-2 text-4xl font-bold text-primary">
            {order.displayNumber}
          </p>
          {!isCancelled && (
            <p className="mt-2 text-sm text-gray-500">
              Guarde este numero para acompanhar seu pedido.
            </p>
          )}
        </div>

        {/* Timeline de status */}
        {!isCancelled && (
          <div className="mt-5 rounded-xl bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-semibold">Acompanhe seu pedido</h3>
            <div className="space-y-0">
              {steps.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const Icon = step.icon;
                const isLast = index === steps.length - 1;

                return (
                  <div key={step.key} className="flex gap-3">
                    {/* Indicador */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          isCurrent
                            ? "bg-primary text-white"
                            : isCompleted
                              ? "bg-green-100 text-green-600"
                              : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      {!isLast && (
                        <div
                          className={`h-8 w-0.5 ${
                            isCompleted && index < currentStepIndex
                              ? "bg-green-300"
                              : "bg-gray-200"
                          }`}
                        />
                      )}
                    </div>

                    {/* Label */}
                    <div className="pb-6">
                      <p
                        className={`text-sm font-medium ${
                          isCurrent
                            ? "text-primary"
                            : isCompleted
                              ? "text-green-700"
                              : "text-gray-400"
                        }`}
                      >
                        {step.label}
                      </p>
                      {isCurrent && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          Status atual
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Resumo */}
        <div className="mt-5 rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">Resumo do pedido</h3>
          <div className="space-y-2 text-sm">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span className="text-gray-600">
                  {item.quantity}x {item.productName}
                  {item.variantName && ` (${item.variantName})`}
                </span>
                <span>{formatCurrency(parseFloat(item.totalPrice))}</span>
              </div>
            ))}
            <div className="border-t pt-2">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{formatCurrency(parseFloat(order.subtotal))}</span>
              </div>
              {parseFloat(order.deliveryFee) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Entrega</span>
                  <span>
                    {formatCurrency(parseFloat(order.deliveryFee))}
                  </span>
                </div>
              )}
              {parseFloat(order.discount) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Desconto</span>
                  <span>-{formatCurrency(parseFloat(order.discount))}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">
                  {formatCurrency(parseFloat(order.total))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Avaliacao */}
        {order.status === "DELIVERED" || order.status === "PICKED_UP" ? (
          <div className="mt-5">
            <ReviewForm orderId={order.id} tenantId={order.tenantId} />
          </div>
        ) : null}

        {/* Pontos ganhos */}
        {order.loyaltyPointsEarned > 0 && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
            <span className="text-2xl">*</span>
            <p className="text-sm text-yellow-800">
              Voce ganhou{" "}
              <strong>{order.loyaltyPointsEarned} pontos</strong> de
              fidelidade neste pedido!
            </p>
          </div>
        )}

        {/* Voltar */}
        <Link
          href={`/restaurantes/${slug}`}
          className="mt-6 block w-full rounded-full border-2 border-primary py-3 text-center font-semibold text-primary transition-colors hover:bg-primary/5"
        >
          Voltar ao cardapio
        </Link>
      </div>
    </div>
  );
}
