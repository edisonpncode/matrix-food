"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  Phone,
  ShieldCheck,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

/**
 * Página pessoal: OWNER ou MANAGER cadastra seu WhatsApp e verifica via OTP.
 */
export default function MorpheuMeuAcessoPage() {
  const utils = trpc.useUtils();
  const meQ = trpc.morpheu.me.get.useQuery();

  const requestOtp = trpc.morpheu.me.requestOtp.useMutation({
    onSuccess: () => {
      setStep("verify");
      setFeedback({
        type: "success",
        message: "Código enviado! Chegou no seu WhatsApp?",
      });
    },
    onError: (err) =>
      setFeedback({ type: "error", message: err.message ?? "Erro" }),
  });
  const verifyOtp = trpc.morpheu.me.verifyOtp.useMutation({
    onSuccess: () => {
      utils.morpheu.me.get.invalidate();
      setStep("done");
      setFeedback({ type: "success", message: "Telefone verificado!" });
      setOtp("");
    },
    onError: (err) =>
      setFeedback({ type: "error", message: err.message ?? "Código incorreto" }),
  });
  const removePhone = trpc.morpheu.me.removePhone.useMutation({
    onSuccess: () => {
      utils.morpheu.me.get.invalidate();
      setStep("phone");
      setPhone("");
      setFeedback({ type: "success", message: "Telefone removido." });
    },
  });

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "verify" | "done">("phone");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  if (meQ.isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const me = meQ.data;

  if (!me) {
    return (
      <div className="space-y-4">
        <Link
          href="/restaurante/admin/configuracoes/morpheu"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <div className="rounded-xl border bg-muted/30 p-8 text-center">
          <XCircle className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
          <p className="text-sm">
            Você ainda não tem acesso ao Morpheu neste restaurante. Peça ao dono
            pra designá-lo como gerente.
          </p>
        </div>
      </div>
    );
  }

  const alreadyVerified = me.phoneVerified && me.phoneE164;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/restaurante/admin/configuracoes/morpheu"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Meu acesso ao Morpheu</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre seu WhatsApp pra receber notificações e conversar com o
          Morpheu. Papel neste restaurante:{" "}
          <strong>{me.role === "OWNER" ? "Dono" : "Gerente"}</strong>.
        </p>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-2 text-sm ${
            feedback.type === "success"
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {alreadyVerified ? (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-6 w-6 text-green-600" />
            <div className="flex-1">
              <p className="font-semibold">Telefone verificado</p>
              <p className="font-mono text-sm">{me.phoneE164}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Você já pode enviar mensagens pro Morpheu pelo WhatsApp e
                receberá as notificações habilitadas neste restaurante.
              </p>
            </div>
            <button
              onClick={() => removePhone.mutate()}
              disabled={removePhone.isPending}
              className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Step 1: telefone */}
          {step === "phone" && (
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Etapa 1: informe seu WhatsApp</h2>
              </div>
              <label className="mb-1 block text-sm font-medium">
                Número com DDD
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(51) 99999-9999"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Você receberá um código de 6 dígitos no seu WhatsApp em alguns
                segundos.
              </p>
              <button
                onClick={() => {
                  setFeedback(null);
                  requestOtp.mutate({ phone });
                }}
                disabled={!phone || requestOtp.isPending}
                className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {requestOtp.isPending ? "Enviando..." : "Enviar código"}
              </button>
            </div>
          )}

          {/* Step 2: OTP */}
          {step === "verify" && (
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Etapa 2: informe o código</h2>
              </div>
              <label className="mb-1 block text-sm font-medium">
                Código de 6 dígitos
              </label>
              <input
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                className="w-40 rounded-lg border px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setFeedback(null);
                    verifyOtp.mutate({ code: otp });
                  }}
                  disabled={otp.length !== 6 || verifyOtp.isPending}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {verifyOtp.isPending ? "Verificando..." : "Verificar"}
                </button>
                <button
                  onClick={() => {
                    setStep("phone");
                    setFeedback(null);
                  }}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-accent"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Contexto */}
      <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Como funciona</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            O Morpheu envia notificações e responde perguntas pelo WhatsApp
            Business (número oficial da Matrix Food).
          </li>
          <li>
            Seus dados de vendas nunca vão pra fora do sistema — só você recebe
            os insights deste restaurante.
          </li>
          <li>
            Pode cancelar a qualquer momento clicando em &quot;Remover&quot;
            acima.
          </li>
        </ul>
      </div>
    </div>
  );
}
