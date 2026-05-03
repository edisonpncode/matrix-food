"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Clock, Mail, Home } from "lucide-react";

function WaitlistContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#fafafa] px-5 py-12">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-gradient-to-br from-purple-400/15 to-violet-600/5 blur-[100px]" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="rounded-2xl border border-black/5 bg-white p-8 shadow-sm sm:p-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] shadow-lg shadow-purple-500/25">
            <Clock className="h-8 w-8 text-white" />
          </div>

          <h1 className="mb-3 text-center text-2xl font-extrabold tracking-tight text-[#1a1a2e]">
            Sistema em alta demanda
          </h1>

          <p className="mb-6 text-center text-sm leading-relaxed text-[#64748b]">
            Atingimos o limite máximo de restaurantes nesta fase inicial. Em
            algumas horas serão liberadas novas vagas e alguém do nosso time
            entrará em contato para concluir seu cadastro.
          </p>

          {email && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#e2e8f0] bg-[#fafafa] px-4 py-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#7c3aed]" />
              <div className="text-sm">
                <p className="text-[#64748b]">Você será contatado em:</p>
                <p className="font-semibold text-[#1a1a2e] break-all">
                  {email}
                </p>
              </div>
            </div>
          )}

          <div className="mb-6 rounded-xl bg-purple-50 px-4 py-3 text-center text-xs text-[#6d28d9]">
            Sua conta já está pré-cadastrada — você não precisa fazer nada
            agora. Avisaremos assim que liberarmos seu acesso.
          </div>

          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-purple-500/20 transition-all hover:shadow-lg"
          >
            <Home className="h-4 w-4" />
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function ListaDeEsperaPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#fafafa]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#7c3aed] border-t-transparent" />
        </main>
      }
    >
      <WaitlistContent />
    </Suspense>
  );
}
