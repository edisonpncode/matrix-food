"use client";

import Link from "next/link";
import { ArrowLeft, Search, MapPin, Store } from "lucide-react";

export default function RestaurantesPage() {
  return (
    <main className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-5">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-[#64748b] hover:text-[#7c3aed]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Buscar restaurante..."
                className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8f9fa] py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="mb-6 text-2xl font-bold text-[#1a1a2e]">
          Restaurantes
        </h1>

        {/* Empty state - will be populated later */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#e2e8f0] bg-white py-20">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7c3aed]/10">
            <Store className="h-8 w-8 text-[#7c3aed]" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-[#1a1a2e]">
            Em breve!
          </h2>
          <p className="max-w-sm text-center text-sm text-[#64748b]">
            A listagem de restaurantes estará disponível em breve.
            Enquanto isso, acesse diretamente pelo link do restaurante.
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-[#94a3b8]">
            <MapPin className="h-3.5 w-3.5" />
            Exemplo: matrixfood.com.br/restaurantes/pointlanches
          </div>
        </div>
      </div>
    </main>
  );
}
