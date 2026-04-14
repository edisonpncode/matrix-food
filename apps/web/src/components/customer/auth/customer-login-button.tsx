"use client";

import { useEffect, useRef, useState } from "react";
import { LogIn, User, LogOut } from "lucide-react";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { CustomerAuthModal } from "./customer-auth-modal";

interface CustomerLoginButtonProps {
  /** Quando true, usa estilo translúcido pra ficar legível sobre o banner do restaurante */
  onBanner?: boolean;
}

export function CustomerLoginButton({ onBanner }: CustomerLoginButtonProps) {
  const { customer, isLoading, logout } = useCustomerAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  if (isLoading) {
    return (
      <div
        className={`h-9 w-24 animate-pulse rounded-full ${
          onBanner ? "bg-white/20" : "bg-gray-200"
        }`}
      />
    );
  }

  if (!customer) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            onBanner
              ? "bg-white/90 text-gray-900 hover:bg-white"
              : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
        >
          <LogIn className="h-4 w-4" />
          Entrar
        </button>
        <CustomerAuthModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      </>
    );
  }

  const firstName = customer.name.split(" ")[0] ?? customer.name;
  const initials = firstName.slice(0, 1).toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1.5 text-sm font-semibold transition-colors ${
          onBanner
            ? "bg-white/90 text-gray-900 hover:bg-white"
            : "bg-primary/10 text-primary hover:bg-primary/20"
        }`}
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
            onBanner
              ? "bg-primary text-primary-foreground"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {initials}
        </span>
        {firstName}
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <User className="h-4 w-4 text-gray-500" />
              {customer.name}
            </div>
            {customer.phone && (
              <div className="mt-0.5 text-xs text-gray-500">
                {customer.phone}
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              setMenuOpen(false);
              await logout();
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
