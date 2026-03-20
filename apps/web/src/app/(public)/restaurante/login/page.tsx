"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UtensilsCrossed,
  ShieldCheck,
  Headset,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#fafafa] px-5 py-12">
      {/* Decorative orbs */}
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-purple-400/15 to-violet-600/5 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-32 right-1/4 h-[350px] w-[350px] rounded-full bg-gradient-to-tr from-orange-300/10 to-amber-400/5 blur-[100px]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Back link */}
        <Link
          href="/restaurante"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-[#64748b] transition-colors hover:text-[#7c3aed]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] shadow-lg shadow-purple-500/25">
            <UtensilsCrossed className="h-7 w-7 text-white" />
          </div>
          <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-[#1a1a2e]">
            Entrar no sistema
          </h1>
          <p className="text-sm text-[#64748b]">
            Selecione como deseja acessar
          </p>
        </div>

        {/* Role selection cards */}
        <div className="flex flex-col gap-4">
          <button
            onClick={() => router.push("/restaurante/admin")}
            className="group flex items-center gap-4 rounded-2xl border border-black/5 bg-white p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#7c3aed]/30 hover:shadow-lg hover:shadow-purple-500/5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] text-white shadow-md shadow-purple-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <span className="block text-base font-bold text-[#1a1a2e]">
                Administrador
              </span>
              <span className="block text-sm text-[#64748b]">
                Gerenciar cardápio, pedidos e configurações
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-[#c4b5fd] transition-transform group-hover:translate-x-1 group-hover:text-[#7c3aed]" />
          </button>

          <button
            onClick={() => router.push("/restaurante/pos")}
            className="group flex items-center gap-4 rounded-2xl border border-black/5 bg-white p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#f97316]/30 hover:shadow-lg hover:shadow-orange-500/5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white shadow-md shadow-orange-500/20">
              <Headset className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <span className="block text-base font-bold text-[#1a1a2e]">
                Funcionário
              </span>
              <span className="block text-sm text-[#64748b]">
                Tirar pedidos, atender clientes e caixa
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-[#fed7aa] transition-transform group-hover:translate-x-1 group-hover:text-[#f97316]" />
          </button>
        </div>

        {/* Register link */}
        <p className="mt-8 text-center text-sm text-[#64748b]">
          Ainda não tem conta?{" "}
          <Link
            href="/restaurante/cadastro"
            className="font-semibold text-[#7c3aed] hover:underline"
          >
            Cadastre-se
          </Link>
        </p>
      </div>
    </main>
  );
}
