"use client";

import { useState, useEffect } from "react";
import { X, UserPlus, Loader2, Mail, Lock, ArrowLeft } from "lucide-react";
import { useLoggedUsersStore } from "@/lib/logged-users-store";
import { trpc } from "@/lib/trpc";

interface NewLoginModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "EMAIL" | "ADMIN_PASSWORD" | "STAFF_PASSWORD";

/**
 * Modal "Novo Login" — adiciona novo usuário à lista de logados.
 *
 * Fluxo:
 * 1) Digita email → sistema detecta (admin vs funcionário) via trpc.staff.checkEmail
 * 2a) Se admin → pede senha do Firebase (signInWithEmailAndPassword)
 * 2b) Se funcionário → pede senha forte local (trpc.staff.loginByEmailPassword)
 * 3) Adiciona usuário à lista de logados e define como ativo
 */
export function NewLoginModal({ onClose, onSuccess }: NewLoginModalProps) {
  const [step, setStep] = useState<Step>("EMAIL");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const addUser = useLoggedUsersStore((s) => s.addUser);
  const utils = trpc.useUtils();

  const loginStaff = trpc.staff.loginByEmailPassword.useMutation({
    onSuccess: (data) => {
      addUser({
        id: data.id,
        name: data.name,
        email: data.email ?? null,
        photoUrl: data.photoUrl ?? null,
        role: data.role,
        userTypeId: data.userTypeId ?? null,
        userTypeName: data.userTypeName ?? null,
        permissions: data.permissions ?? {},
        kind: "staff",
      });
      setLoading(false);
      onSuccess();
    },
    onError: (err) => {
      setError(err.message || "Email ou senha inválidos.");
      setLoading(false);
    },
  });

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await utils.staff.checkEmail.fetch({ email });

      if (!result.exists) {
        // Assumimos que é admin se não está na base (Firebase aceita qualquer email válido)
        setStep("ADMIN_PASSWORD");
      } else if (result.kind === "admin") {
        setStep("ADMIN_PASSWORD");
      } else {
        setStep("STAFF_PASSWORD");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível verificar o email."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { initializeApp, getApps } = await import("firebase/app");
      const { getAuth, signInWithEmailAndPassword } = await import(
        "firebase/auth"
      );

      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      };

      const app =
        getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // Tenta localizar o registro OWNER correspondente no tenant
      // (para pegar foto/userTypeName reais). Se não achar, usa dados básicos.
      let name = cred.user.displayName || email.split("@")[0] || "Proprietário";
      let photoUrl: string | null = cred.user.photoURL ?? null;
      let userTypeName: string | null = "Proprietário";
      let userTypeId: string | null = null;

      try {
        const owner = await utils.staff.checkEmail.fetch({ email });
        if (owner.exists) {
          // Carrega dados do owner via list (precisa já estar autenticado no contexto do tenant)
          const list = await utils.staff.list.fetch();
          const found = list.find((u) => u.email === email);
          if (found) {
            name = found.name;
            photoUrl = found.photoUrl ?? null;
            userTypeName = found.userTypeName ?? "Proprietário";
            userTypeId = found.userTypeId ?? null;
          }
        }
      } catch {
        // Silencia — usa valores padrão
      }

      addUser({
        id: cred.user.uid,
        name,
        email: cred.user.email ?? email,
        photoUrl,
        role: "OWNER",
        userTypeId,
        userTypeName,
        permissions: {},
        kind: "admin",
      });
      setLoading(false);
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (
          err.message.includes("user-not-found") ||
          err.message.includes("wrong-password") ||
          err.message.includes("invalid-credential")
        ) {
          setError("Email ou senha incorretos.");
        } else if (err.message.includes("too-many-requests")) {
          setError("Muitas tentativas. Aguarde alguns minutos.");
        } else {
          setError("Ocorreu um erro. Tente novamente.");
        }
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
      setLoading(false);
    }
  }

  function handleStaffPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    loginStaff.mutate({ email, password });
  }

  function backToEmail() {
    setStep("EMAIL");
    setPassword("");
    setError(null);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            {step !== "EMAIL" && (
              <button
                onClick={backToEmail}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <UserPlus className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Novo Login</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {step === "EMAIL" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    autoFocus
                    required
                    className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={!email.trim() || loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Continuar"
                )}
              </button>
            </form>
          )}

          {(step === "ADMIN_PASSWORD" || step === "STAFF_PASSWORD") && (
            <form
              onSubmit={
                step === "ADMIN_PASSWORD"
                  ? handleAdminPasswordSubmit
                  : handleStaffPasswordSubmit
              }
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">
                Entrando como <span className="font-semibold">{email}</span>
              </p>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {step === "ADMIN_PASSWORD"
                    ? "Senha do Proprietário"
                    : "Senha do Funcionário"}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    autoComplete="current-password"
                    autoFocus
                    required
                    className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                {step === "STAFF_PASSWORD" && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    A senha deve ter letras e números (mínimo 8 caracteres).
                  </p>
                )}
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={!password.trim() || loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
