"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UtensilsCrossed,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Lock,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      await signInWithEmailAndPassword(auth, email, password);

      // Redirecionar para o admin (o middleware vai verificar a sessão)
      router.push("/restaurante/admin");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (
          err.message.includes("user-not-found") ||
          err.message.includes("wrong-password") ||
          err.message.includes("invalid-credential")
        ) {
          setError("Email ou senha incorretos.");
        } else if (err.message.includes("too-many-requests")) {
          setError(
            "Muitas tentativas. Aguarde alguns minutos e tente novamente."
          );
        } else {
          setError("Ocorreu um erro. Tente novamente.");
        }
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[#e2e8f0] bg-[#fafafa] pl-11 pr-4 py-3 text-sm text-[#1a1a2e] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10";

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#fafafa] px-5 py-12">
      {/* Decorative orbs */}
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-purple-400/15 to-violet-600/5 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-32 right-1/4 h-[350px] w-[350px] rounded-full bg-gradient-to-tr from-orange-300/10 to-amber-400/5 blur-[100px]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Back link */}
        <Link
          href="/restaurante"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-[#64748b] transition-colors hover:text-[#7c3aed]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] shadow-lg shadow-purple-500/25">
            <UtensilsCrossed className="h-7 w-7 text-white" />
          </div>
          <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-[#1a1a2e]">
            Entrar no sistema
          </h1>
          <p className="text-sm text-[#64748b]">
            Acesse o painel do seu restaurante
          </p>
        </div>

        {/* Login form */}
        <form
          onSubmit={handleLogin}
          className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="space-y-4">
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-purple-500/20 transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>
        </form>

        {/* Register link */}
        <p className="mt-8 text-center text-sm text-[#64748b]">
          Ainda não tem conta?{" "}
          <Link
            href="/restaurante/cadastro"
            className="font-semibold text-[#7c3aed] hover:underline"
          >
            Cadastre-se grátis
          </Link>
        </p>
      </div>
    </main>
  );
}
