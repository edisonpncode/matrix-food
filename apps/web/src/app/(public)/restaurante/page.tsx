"use client";

import Link from "next/link";
import {
  UtensilsCrossed,
  ShoppingBag,
  BarChart3,
  Tag,
  Star,
  Smartphone,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: ShoppingBag,
    title: "Cardápio Digital",
    desc: "Crie e gerencie seu cardápio online com fotos, variações e personalizações.",
  },
  {
    icon: Smartphone,
    title: "Pedidos Online",
    desc: "Receba pedidos diretamente pelo celular ou computador, sem intermediários.",
  },
  {
    icon: Tag,
    title: "Promoções & Combos",
    desc: "Crie combos, descontos, compre e ganhe, e promoções por dia da semana.",
  },
  {
    icon: BarChart3,
    title: "Dashboard Completo",
    desc: "Acompanhe vendas, produtos mais vendidos, horários de pico e muito mais.",
  },
  {
    icon: Star,
    title: "Fidelidade",
    desc: "Programa de pontos para seus clientes voltarem sempre.",
  },
  {
    icon: UtensilsCrossed,
    title: "Multi-tamanho",
    desc: "Pizzas com tamanhos, sabores mistos e preços por tamanho automaticamente.",
  },
];

export default function RestaurantLandingPage() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#6d28d9]">
              <UtensilsCrossed className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-[#1a1a2e]">
              Matrix Food
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/restaurante/login"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-[#7c3aed] transition-colors hover:bg-[#7c3aed]/5"
            >
              Entrar
            </Link>
            <Link
              href="/restaurante/cadastro"
              className="rounded-lg bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-5 py-2 text-sm font-semibold text-white shadow-md shadow-purple-500/20 transition-all hover:shadow-lg hover:shadow-purple-500/30"
            >
              Cadastrar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-20 pt-16 sm:pt-24">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-br from-purple-400/15 to-violet-600/5 blur-[120px]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-sm font-medium text-[#7c3aed]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7c3aed]" />
            Grátis para começar
          </div>
          <h1 className="mb-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-[#1a1a2e] sm:text-5xl lg:text-6xl">
            Tudo que seu{" "}
            <span className="bg-gradient-to-r from-[#7c3aed] via-[#8b5cf6] to-[#a855f7] bg-clip-text text-transparent">
              restaurante
            </span>{" "}
            precisa em um só lugar
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-[#64748b]">
            Cardápio digital, pedidos online, gestão de cozinha, promoções,
            fidelidade e muito mais. Comece gratuitamente em menos de 5 minutos.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/restaurante/cadastro"
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-500/30"
            >
              Começar Agora
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/restaurante/login"
              className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] px-8 py-3.5 text-base font-semibold text-[#475569] transition-all hover:border-[#7c3aed]/30 hover:text-[#7c3aed]"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-5 pb-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-2xl font-bold tracking-tight text-[#1a1a2e] sm:text-3xl">
            Tudo incluso, sem surpresas
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={i}
                className="group rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#7c3aed]/10 text-[#7c3aed] transition-colors group-hover:bg-[#7c3aed] group-hover:text-white">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1.5 text-base font-bold text-[#1a1a2e]">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-[#64748b]">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-3xl rounded-3xl bg-gradient-to-br from-[#7c3aed] to-[#4c1d95] p-10 text-center shadow-2xl shadow-purple-500/20 sm:p-14">
          <h2 className="mb-4 text-2xl font-extrabold text-white sm:text-3xl">
            Pronto para transformar seu restaurante?
          </h2>
          <p className="mb-8 text-base text-purple-100/80">
            Cadastre-se gratuitamente e comece a receber pedidos hoje mesmo.
          </p>
          <Link
            href="/restaurante/cadastro"
            className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-bold text-[#7c3aed] shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            Criar Minha Conta
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 bg-white px-5 py-8">
        <div className="mx-auto max-w-6xl text-center text-sm text-[#94a3b8]">
          &copy; {new Date().getFullYear()} Matrix Food. Todos os direitos
          reservados.
        </div>
      </footer>
    </div>
  );
}
