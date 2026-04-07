"use client";

import { useState } from "react";
import Link from "next/link";
import { User, LogOut, ShoppingBag, Star, UserCircle } from "lucide-react";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { PhoneLoginForm } from "./phone-login-form";

export function LoginButton() {
  const { customer, firebaseUser, loading, signOut } = useCustomerAuth();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="h-9 w-20 animate-pulse rounded-lg bg-white/20" />
    );
  }

  if (firebaseUser && customer) {
    const firstName = customer.name.split(" ")[0];
    return (
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
        >
          <UserCircle className="h-5 w-5" />
          <span className="max-w-[120px] truncate">{firstName}</span>
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">
                  {customer.name}
                </p>
                <p className="text-xs text-gray-500">{customer.phone}</p>
              </div>
              <Link
                href="/conta/perfil"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <User className="h-4 w-4" />
                Meu perfil
              </Link>
              <Link
                href="/conta/pedidos"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <ShoppingBag className="h-4 w-4" />
                Meus pedidos
              </Link>
              <Link
                href="/conta/fidelidade"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Star className="h-4 w-4" />
                Meus pontos
              </Link>
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  await signOut();
                }}
                className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
      >
        Entrar
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Entrar</h2>
              <p className="mt-1 text-sm text-gray-600">
                Use seu telefone para entrar e acompanhar seus pedidos e
                pontos.
              </p>
            </div>
            <PhoneLoginForm onSuccess={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
