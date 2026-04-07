"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, User, ShoppingBag, Star } from "lucide-react";
import { useCustomerAuth } from "@/lib/customer-auth-context";

const TABS = [
  { href: "/conta/perfil", label: "Perfil", icon: User },
  { href: "/conta/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/conta/fidelidade", label: "Pontos", icon: Star },
];

export default function ContaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { firebaseUser, loading } = useCustomerAuth();

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.replace("/");
    }
  }, [loading, firebaseUser, router]);

  if (loading || !firebaseUser) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-purple-600 text-white shadow">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <button
            onClick={() => router.back()}
            className="rounded-full p-1 hover:bg-white/10"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">Minha conta</h1>
        </div>
        <nav className="mx-auto flex max-w-2xl gap-1 px-2">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition ${
                  active
                    ? "border-white text-white"
                    : "border-transparent text-white/70 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}
