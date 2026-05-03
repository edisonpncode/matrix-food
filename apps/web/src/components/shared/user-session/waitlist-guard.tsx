"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

/**
 * Bloqueia o painel /restaurante/admin para tenants que ainda não foram
 * aprovados pelo superadmin (status = WAITLIST ou SUSPENDED). Quando
 * detectado, redireciona para a tela de "lista de espera".
 *
 * Roda dentro do layout autenticado, então o tenant já existe — basta
 * checar status com `tenant.getMyStatus`.
 */
export function WaitlistGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, isLoading } = trpc.tenant.getMyStatus.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data) return;
    if (data.status && data.status !== "ACTIVE") {
      router.replace("/restaurante/cadastro/lista-de-espera");
    }
  }, [data, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fafafa]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#7c3aed] border-t-transparent" />
      </div>
    );
  }

  if (data?.status && data.status !== "ACTIVE") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fafafa]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#7c3aed] border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
