"use client";

import { useEffect, useRef, useState } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

interface Props {
  onSuccess?: () => void;
}

/**
 * Formata telefone brasileiro para E.164 (+55DDDNNNNNNNNN).
 */
function toE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return null;
}

function formatBR(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function PhoneLoginForm({ onSuccess }: Props) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        try {
          recaptchaRef.current.clear();
        } catch {
          // ignore
        }
        recaptchaRef.current = null;
      }
    };
  }, []);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const e164 = toE164(phone);
    if (!e164) {
      setError("Telefone invalido. Use DDD + numero.");
      return;
    }
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(
          auth,
          recaptchaContainerRef.current!,
          { size: "invisible" }
        );
      }
      const result = await signInWithPhoneNumber(
        auth,
        e164,
        recaptchaRef.current
      );
      confirmationRef.current = result;
      setStep("code");
    } catch (err) {
      console.error(err);
      setError(
        "Nao foi possivel enviar o SMS. Verifique o numero e tente novamente."
      );
      if (recaptchaRef.current) {
        try {
          recaptchaRef.current.clear();
        } catch {
          // ignore
        }
        recaptchaRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!confirmationRef.current) {
      setError("Sessao expirou. Comece de novo.");
      setStep("phone");
      return;
    }
    setLoading(true);
    try {
      await confirmationRef.current.confirm(code);
      onSuccess?.();
    } catch (err) {
      console.error(err);
      setError("Codigo invalido. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div ref={recaptchaContainerRef} />

      {step === "phone" ? (
        <form onSubmit={handleSendCode} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Telefone (com DDD)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatBR(e.target.value))}
              placeholder="(11) 91234-5678"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Receber codigo por SMS"}
          </button>
          <p className="text-xs text-gray-500">
            Enviamos um codigo de 6 digitos para confirmar seu numero.
          </p>
        </form>
      ) : (
        <form onSubmit={handleConfirm} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Codigo recebido por SMS
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="123456"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl tracking-widest focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? "Validando..." : "Entrar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError(null);
            }}
            className="w-full text-sm text-gray-600 hover:text-gray-900"
          >
            Usar outro numero
          </button>
        </form>
      )}
    </div>
  );
}
