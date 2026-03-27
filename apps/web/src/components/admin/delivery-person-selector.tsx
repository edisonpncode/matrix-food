"use client";

import { User, Phone, X } from "lucide-react";

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
            {deliveryPeople.map((person) => (
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
              </button>
            ))}
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
