"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { getLastRestaurantSlug } from "@/lib/last-restaurant";

interface ContaShellProps {
  title: string;
  /**
   * Caminho do botão voltar. Se ausente, volta pro último restaurante visitado
   * (sessionStorage); se não houver, usa router.back().
   */
  backHref?: string;
  children: ReactNode;
}

export function ContaShell({ title, backHref, children }: ContaShellProps) {
  const { customer, isLoading } = useCustomerAuth();
  const router = useRouter();
  const [resolvedBackHref, setResolvedBackHref] = useState<string | null>(
    backHref ?? null
  );

  useEffect(() => {
    if (backHref) return;
    const slug = getLastRestaurantSlug();
    if (slug) setResolvedBackHref(`/restaurantes/${slug}`);
  }, [backHref]);

  useEffect(() => {
    if (!isLoading && !customer) {
      router.replace("/");
    }
  }, [customer, isLoading, router]);

  if (isLoading || !customer) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {resolvedBackHref ? (
            <Link
              href={resolvedBackHref}
              className="-ml-1 rounded-full p-1.5 text-gray-700 hover:bg-gray-100"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => router.back()}
              className="-ml-1 rounded-full p-1.5 text-gray-700 hover:bg-gray-100"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
