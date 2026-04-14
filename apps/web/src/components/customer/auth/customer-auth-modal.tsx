"use client";

import { useEffect, useState } from "react";
import { X, Phone, User, Lock, ArrowLeft, Loader2 } from "lucide-react";
import { formatBrazilianPhone, stripPhone } from "@/lib/format-phone";
import { useCustomerAuth } from "@/lib/customer-auth-context";

type PhoneStatus = "NEW" | "NEEDS_PASSWORD" | "HAS_PASSWORD";
type Step = "phone" | "register" | "set-password" | "login";

interface CustomerAuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CustomerAuthModal({
  open,
  onClose,
  onSuccess,
}: CustomerAuthModalProps) {
  const { refetch } = useCustomerAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [existingName, setExistingName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setStep("phone");
      setPhone("");
      setExistingName(null);
      setName("");
      setPassword("");
      setPasswordConfirm("");
      setError(null);
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const phoneDigits = stripPhone(phone);
  const phoneValid = phoneDigits.length >= 10 && phoneDigits.length <= 11;

  async function handleCheckPhone() {
    setError(null);
    if (!phoneValid) {
      setError("Digite um telefone válido (DDD + número).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/customer/auth/check-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneDigits }),
      });
      const data = (await res.json()) as {
        status?: PhoneStatus;
        name?: string;
        error?: string;
      };
      if (!res.ok || !data.status) {
        setError(data.error ?? "Falha ao verificar telefone.");
        return;
      }
      if (data.name) setExistingName(data.name);
      if (data.status === "NEW") setStep("register");
      else if (data.status === "NEEDS_PASSWORD") setStep("set-password");
      else setStep("login");
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Informe seu nome.");
      return;
    }
    if (password.length < 6) {
      setError("Senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/customer/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phoneDigits,
          password,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Falha ao criar conta.");
        return;
      }
      await refetch();
      onSuccess?.();
      onClose();
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword() {
    setError(null);
    if (password.length < 6) {
      setError("Senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/customer/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneDigits, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Falha ao criar senha.");
        return;
      }
      await refetch();
      onSuccess?.();
      onClose();
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setError(null);
    if (!password) {
      setError("Digite sua senha.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/customer/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneDigits, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Telefone ou senha incorretos.");
        return;
      }
      await refetch();
      onSuccess?.();
      onClose();
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function goBackToPhone() {
    setStep("phone");
    setPassword("");
    setPasswordConfirm("");
    setName("");
    setError(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            {step !== "phone" && (
              <button
                onClick={goBackToPhone}
                className="rounded-full p-1 hover:bg-gray-100"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
            )}
            <h2 className="text-lg font-bold text-gray-900">
              {step === "phone" && "Entrar ou Cadastrar"}
              {step === "register" && "Criar conta"}
              {step === "set-password" && "Criar senha"}
              {step === "login" && "Entrar"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {step === "phone" && (
            <>
              <p className="text-sm text-gray-600">
                Digite seu telefone para continuar. Vamos verificar se você já
                tem conta.
              </p>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  Telefone
                </span>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-primary">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    inputMode="tel"
                    autoFocus
                    value={phone}
                    onChange={(e) =>
                      setPhone(formatBrazilianPhone(e.target.value))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && phoneValid && !loading) {
                        void handleCheckPhone();
                      }
                    }}
                    placeholder="(11) 91234-5678"
                    className="flex-1 bg-transparent text-base outline-none"
                  />
                </div>
              </label>
              <button
                disabled={!phoneValid || loading}
                onClick={handleCheckPhone}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Continuar"
                )}
              </button>
            </>
          )}

          {step === "register" && (
            <>
              <p className="text-sm text-gray-600">
                Não encontramos esse telefone. Vamos criar sua conta rapidinho.
              </p>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  Nome
                </span>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-primary">
                  <User className="h-4 w-4 text-gray-400" />
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="flex-1 bg-transparent text-base outline-none"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  Senha
                </span>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-primary">
                  <Lock className="h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="flex-1 bg-transparent text-base outline-none"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  Confirmar senha
                </span>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-primary">
                  <Lock className="h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !loading) {
                        void handleRegister();
                      }
                    }}
                    placeholder="Repita a senha"
                    className="flex-1 bg-transparent text-base outline-none"
                  />
                </div>
              </label>
              <button
                disabled={loading}
                onClick={handleRegister}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Criar conta"
                )}
              </button>
            </>
          )}

          {step === "set-password" && (
            <>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">
                  Olá, {existingName ?? "cliente"}!
                </span>{" "}
                Você já tem cadastro conosco. Crie uma senha para acessar sua
                conta.
              </p>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  Nova senha
                </span>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-primary">
                  <Lock className="h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="flex-1 bg-transparent text-base outline-none"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  Confirmar senha
                </span>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-primary">
                  <Lock className="h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !loading) {
                        void handleSetPassword();
                      }
                    }}
                    placeholder="Repita a senha"
                    className="flex-1 bg-transparent text-base outline-none"
                  />
                </div>
              </label>
              <button
                disabled={loading}
                onClick={handleSetPassword}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Criar senha e entrar"
                )}
              </button>
            </>
          )}

          {step === "login" && (
            <>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">
                  Olá, {existingName ?? "cliente"}!
                </span>{" "}
                Digite sua senha para entrar.
              </p>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  Senha
                </span>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-primary">
                  <Lock className="h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !loading) {
                        void handleLogin();
                      }
                    }}
                    placeholder="Sua senha"
                    className="flex-1 bg-transparent text-base outline-none"
                  />
                </div>
              </label>
              <button
                disabled={loading}
                onClick={handleLogin}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Entrar"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
