"use client";

import Link from "next/link";
import { Store, UtensilsCrossed, ChevronRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#fafafa] px-5 py-12">
      {/* Decorative gradient orbs */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-gradient-to-br from-purple-400/20 to-violet-600/10 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-orange-300/15 to-amber-400/10 blur-[100px]" />

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center"
        style={{ animation: "fadeInUp 0.7s cubic-bezier(0.4,0,0.2,1) both" }}
      >
        {/* Logo */}
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] shadow-lg shadow-purple-500/25">
          <UtensilsCrossed className="h-8 w-8 text-white" strokeWidth={2.2} />
        </div>

        {/* Brand */}
        <h1 className="mb-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
          <span className="bg-gradient-to-r from-[#7c3aed] via-[#8b5cf6] to-[#6d28d9] bg-clip-text text-transparent">
            Matrix Food
          </span>
        </h1>

        <p className="mb-12 max-w-md text-center text-base leading-relaxed text-[#64748b] sm:text-lg">
          A plataforma completa para restaurantes.
          <br className="hidden sm:block" />
          Cardápio digital, pedidos online e gestão inteligente.
        </p>

        {/* Action cards */}
        <div className="flex w-full max-w-lg flex-col gap-4 sm:flex-row sm:gap-5">
          {/* Sou Restaurante */}
          <Link
            href="/restaurante"
            className="group relative flex flex-1 flex-col items-center gap-3 overflow-hidden rounded-2xl border border-[#e2e0f5] bg-white px-6 py-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#7c3aed]/40 hover:shadow-lg hover:shadow-purple-500/10 sm:py-10"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] text-white shadow-md shadow-purple-500/20 transition-transform duration-300 group-hover:scale-105">
              <Store className="h-7 w-7" strokeWidth={2} />
            </div>
            <span className="text-lg font-bold tracking-tight text-[#1a1a2e]">
              Sou Restaurante
            </span>
            <span className="text-center text-sm leading-snug text-[#64748b]">
              Gerencie seu cardápio, pedidos e equipe
            </span>
            <ChevronRight className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#c4b5fd] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
          </Link>

          {/* Pedir Comida */}
          <Link
            href="/restaurantes"
            className="group relative flex flex-1 flex-col items-center gap-3 overflow-hidden rounded-2xl border border-[#fde2c4] bg-white px-6 py-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#f97316]/40 hover:shadow-lg hover:shadow-orange-500/10 sm:py-10"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white shadow-md shadow-orange-500/20 transition-transform duration-300 group-hover:scale-105">
              <UtensilsCrossed className="h-7 w-7" strokeWidth={2} />
            </div>
            <span className="text-lg font-bold tracking-tight text-[#1a1a2e]">
              Pedir Comida
            </span>
            <span className="text-center text-sm leading-snug text-[#64748b]">
              Encontre restaurantes e faça seu pedido
            </span>
            <ChevronRight className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#fed7aa] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
          </Link>
        </div>
      </div>

      {/* Footer tagline */}
      <p
        className="relative z-10 mt-16 text-xs font-medium tracking-wide text-[#94a3b8]"
        style={{
          animation: "fadeInUp 0.7s cubic-bezier(0.4,0,0.2,1) 0.3s both",
        }}
      >
        &copy; {new Date().getFullYear()} Matrix Food
      </p>

      {/* Inline keyframes */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
