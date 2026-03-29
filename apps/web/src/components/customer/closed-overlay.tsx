"use client";

import { Clock, Eye } from "lucide-react";

interface ClosedOverlayProps {
  nextOpenTime: string | null;
  onDismiss: () => void;
}

export function ClosedOverlay({ nextOpenTime, onDismiss }: ClosedOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <Clock className="h-8 w-8 text-red-500" />
        </div>

        <h2 className="text-xl font-bold text-gray-900">
          Restaurante fechado
        </h2>

        {nextOpenTime && (
          <p className="mt-2 text-sm text-gray-500">{nextOpenTime}</p>
        )}

        <p className="mt-3 text-sm text-gray-400">
          Voce pode ver o cardapio, mas nao e possivel fazer pedidos agora.
        </p>

        <button
          onClick={onDismiss}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary py-3 font-semibold text-primary transition-colors hover:bg-primary/5"
        >
          <Eye className="h-4 w-4" />
          Ver cardapio mesmo assim
        </button>
      </div>
    </div>
  );
}
