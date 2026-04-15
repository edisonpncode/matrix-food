"use client";

import { User, Phone, X } from "lucide-react";
import { formatCurrency } from "@matrix-food/utils";
import { trpc } from "@/lib/trpc";

interface DeliveryPerson {
  id: string;
  name: string;
  phone: string | null;
}

interface DeliveryPersonSelectorProps {
  deliveryPeople: DeliveryPerson[];
  onSelect: (personId: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function DeliveryPersonSelector({
  deliveryPeople,
  onSelect,
  onClose,
  isLoading,
}: DeliveryPersonSelectorProps) {
  // Saldo atual de cada motoboy (últimos 30 dias) — ajuda o atendente a decidir
  // quem está "carregado" e deveria pegar a próxima entrega.
  const balancesQuery = trpc.order.getDeliveryPersonBalances.useQuery();

  const balanceMap = new Map(
    (balancesQuery.data ?? []).map((b) => [b.deliveryPersonId, b])
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Selecionar Entregador</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* List */}
        {deliveryPeople.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum entregador ativo encontrado.
          </p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {deliveryPeople.map((person) => {
              const balance = balanceMap.get(person.id);
              const bal = balance ? parseFloat(balance.balance) : 0;
              const activeDeliveries = balance?.orderCount ?? 0;
              return (
                <button
                  key={person.id}
                  onClick={() => onSelect(person.id)}
                  disabled={isLoading}
                  className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <span className="block text-sm font-medium">
                      {person.name}
                    </span>
                    {person.phone && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {person.phone}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end text-xs">
                    <span
                      className={`rounded px-2 py-0.5 font-semibold ${
                        bal > 0
                          ? "bg-green-50 text-green-700"
                          : bal < 0
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {formatCurrency(bal)}
                    </span>
                    <span className="mt-0.5 text-muted-foreground">
                      {activeDeliveries}{" "}
                      {activeDeliveries === 1 ? "entrega" : "entregas"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Cancel */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-accent"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
