"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UtensilsCrossed,
  ArrowLeft,
  ArrowRight,
  User,
  Store,
  Check,
  Loader2,
} from "lucide-react";

export default function CadastroPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 - Owner data
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  // Step 2 - Restaurant data
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantType, setRestaurantType] = useState("");
  const [restaurantCity, setRestaurantCity] = useState("");

  const canProceedStep1 =
    ownerName.trim() && ownerEmail.trim() && ownerPassword.trim();
  const canFinish = restaurantName.trim() && restaurantType;

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7)
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  async function handleFinish() {
    setLoading(true);
    // TODO: integrate with Firebase Auth + tRPC tenant.create
    // For now, simulate and redirect
    await new Promise((r) => setTimeout(r, 1500));
    router.push("/restaurante/admin");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#fafafa] px-5 py-12">
      {/* Decorative orb */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-gradient-to-br from-purple-400/15 to-violet-600/5 blur-[100px]" />

      <div className="relative z-10 w-full max-w-lg">
        {/* Back */}
        <Link
          href="/restaurante"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#64748b] transition-colors hover:text-[#7c3aed]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] shadow-lg shadow-purple-500/25">
            <UtensilsCrossed className="h-7 w-7 text-white" />
          </div>
          <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#1a1a2e]">
            Criar sua conta
          </h1>
          <p className="text-sm text-[#64748b]">
            {step === 1
              ? "Primeiro, seus dados pessoais"
              : "Agora, os dados do restaurante"}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                step >= 1
                  ? "bg-[#7c3aed] text-white"
                  : "bg-[#e2e8f0] text-[#94a3b8]"
              }`}
            >
              {step > 1 ? <Check className="h-4 w-4" /> : <User className="h-4 w-4" />}
            </div>
            <span
              className={`text-sm font-medium ${
                step >= 1 ? "text-[#1a1a2e]" : "text-[#94a3b8]"
              }`}
            >
              Seus Dados
            </span>
          </div>
          <div className="h-px flex-1 bg-[#e2e8f0]">
            <div
              className="h-full bg-[#7c3aed] transition-all duration-500"
              style={{ width: step >= 2 ? "100%" : "0%" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                step >= 2
                  ? "bg-[#7c3aed] text-white"
                  : "bg-[#e2e8f0] text-[#94a3b8]"
              }`}
            >
              <Store className="h-4 w-4" />
            </div>
            <span
              className={`text-sm font-medium ${
                step >= 2 ? "text-[#1a1a2e]" : "text-[#94a3b8]"
              }`}
            >
              Restaurante
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-8">
          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                  Nome completo *
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full rounded-xl border border-[#e2e8f0] bg-[#fafafa] px-4 py-3 text-sm text-[#1a1a2e] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                  E-mail *
                </label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-xl border border-[#e2e8f0] bg-[#fafafa] px-4 py-3 text-sm text-[#1a1a2e] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                  Celular / WhatsApp
                </label>
                <input
                  type="tel"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(formatPhone(e.target.value))}
                  placeholder="(99) 99999-9999"
                  className="w-full rounded-xl border border-[#e2e8f0] bg-[#fafafa] px-4 py-3 text-sm text-[#1a1a2e] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                  Senha *
                </label>
                <input
                  type="password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-[#e2e8f0] bg-[#fafafa] px-4 py-3 text-sm text-[#1a1a2e] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10"
                />
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-purple-500/20 transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prosseguir
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                  Nome do restaurante *
                </label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Ex: Point Lanches"
                  className="w-full rounded-xl border border-[#e2e8f0] bg-[#fafafa] px-4 py-3 text-sm text-[#1a1a2e] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                  Tipo de estabelecimento *
                </label>
                <select
                  value={restaurantType}
                  onChange={(e) => setRestaurantType(e.target.value)}
                  className="w-full rounded-xl border border-[#e2e8f0] bg-[#fafafa] px-4 py-3 text-sm text-[#1a1a2e] outline-none transition-colors focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10"
                >
                  <option value="">Selecione...</option>
                  <option value="lanchonete">Lanchonete</option>
                  <option value="pizzaria">Pizzaria</option>
                  <option value="hamburgueria">Hamburgueria</option>
                  <option value="restaurante">Restaurante</option>
                  <option value="acai">Açaiteria</option>
                  <option value="pastelaria">Pastelaria</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                  Cidade
                </label>
                <input
                  type="text"
                  value={restaurantCity}
                  onChange={(e) => setRestaurantCity(e.target.value)}
                  placeholder="Ex: São Paulo - SP"
                  className="w-full rounded-xl border border-[#e2e8f0] bg-[#fafafa] px-4 py-3 text-sm text-[#1a1a2e] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#e2e8f0] px-5 py-3 text-sm font-semibold text-[#64748b] transition-all hover:border-[#7c3aed]/30 hover:text-[#7c3aed]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </button>
                <button
                  onClick={handleFinish}
                  disabled={!canFinish || loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-purple-500/20 transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Concluir Cadastro
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Login link */}
        <p className="mt-6 text-center text-sm text-[#64748b]">
          Já tem conta?{" "}
          <Link
            href="/restaurante/login"
            className="font-semibold text-[#7c3aed] hover:underline"
          >
            Faça login
          </Link>
        </p>
      </div>
    </main>
  );
}
