"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Shield,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    urlError === "forbidden"
      ? "Este usuário não tem permissão de administrador."
      : ""
  );

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");

  const canSubmit = email.trim() && password.trim();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

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
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const idToken = await credential.user.getIdToken();

      const response = await fetch("/api/login", {
        method: "GET",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!response.ok) {
        setError("Falha ao abrir sessão. Tente novamente.");
        setLoading(false);
        return;
      }

      // Registrar log de auditoria (fire-and-forget)
      fetch("/api/admin/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "login_success", email: email.trim() }),
      }).catch(() => {});

      router.push("/admin");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (
        message.includes("user-not-found") ||
        message.includes("wrong-password") ||
        message.includes("invalid-credential")
      ) {
        setError("Email ou senha incorretos.");
      } else if (message.includes("too-many-requests")) {
        setError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetStatus("sending");
    try {
      const { initializeApp, getApps } = await import("firebase/app");
      const { getAuth, sendPasswordResetEmail } = await import("firebase/auth");
      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      };
      const app =
        getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetStatus("sent");
    } catch {
      // Mesmo em erro mostramos "enviado" para não vazar quais emails existem
      setResetStatus("sent");
    }
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/40 focus:border-[#a78bfa] focus:ring-2 focus:ring-[#a78bfa]/20";

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0b0b1a] px-5 py-12">
      {/* Decorative orbs */}
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-purple-600/25 to-violet-800/5 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 right-1/4 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-fuchsia-600/15 to-purple-900/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] shadow-lg shadow-purple-900/40">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-white">
            Painel Administrativo
          </h1>
          <p className="text-sm text-white/60">
            Acesso restrito — somente administradores Matrix Food
          </p>
        </div>

        {resetOpen ? (
          <form
            onSubmit={handleResetPassword}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8"
          >
            <h2 className="mb-4 text-lg font-bold text-white">
              Redefinir senha
            </h2>
            <p className="mb-4 text-sm text-white/60">
              Informe o email do administrador. Se existir, enviaremos um link
              para redefinir a senha.
            </p>
            <div className="relative mb-4">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="seu@email.com"
                className={inputClass}
                autoFocus
              />
            </div>
            {resetStatus === "sent" && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Se o email existir, um link de redefinição foi enviado.
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setResetOpen(false);
                  setResetStatus("idle");
                  setResetEmail("");
                }}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/5"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={!resetEmail.trim() || resetStatus === "sending"}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-purple-900/30 transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resetStatus === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar"
                )}
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleLogin}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8"
          >
            <div className="space-y-4">
              {/* Email */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/80">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@matrixfood.com.br"
                    autoComplete="email"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/80">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    autoComplete="current-password"
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0 translate-y-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-purple-900/30 transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
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

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setResetOpen(true)}
                  className="text-xs text-white/50 underline-offset-2 hover:text-white/80 hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
