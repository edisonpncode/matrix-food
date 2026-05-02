"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Save, CheckCircle, XCircle, CreditCard } from "lucide-react";
import { PaymentMethodsManager } from "@/components/admin/payment-methods-manager";
import { DEFAULT_PAYMENT_METHODS, type PaymentMethodConfig } from "@matrix-food/utils";

export default function FormasPagamentoPage() {
  const tenant = trpc.tenant.getById.useQuery();
  const utils = trpc.useUtils();
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const updateMutation = trpc.tenant.update.useMutation({
    onSuccess: () => {
      utils.tenant.getById.invalidate();
      setToast({ type: "success", message: "Formas de pagamento salvas com sucesso!" });
      setTimeout(() => setToast(null), 4000);
    },
    onError: (err) => {
      setToast({ type: "error", message: err.message || "Erro ao salvar formas de pagamento." });
      setTimeout(() => setToast(null), 5000);
    },
  });

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(DEFAULT_PAYMENT_METHODS);

  useEffect(() => {
    if (tenant.data) {
      const accepted = tenant.data.paymentMethodsAccepted as PaymentMethodConfig[] | null;
      if (accepted && accepted.length > 0) {
        setPaymentMethods(accepted);
      } else {
        setPaymentMethods(DEFAULT_PAYMENT_METHODS);
      }
    }
  }, [tenant.data]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      paymentMethodsAccepted: paymentMethods,
    });
  }

  if (tenant.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 flex items-center gap-3 rounded-lg px-5 py-3 shadow-lg transition-all ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">
            &times;
          </button>
        </div>
      )}

      <h1 className="text-2xl font-bold text-foreground">Formas de Pagamento</h1>
      <p className="mt-1 text-muted-foreground">
        Configure quais formas de pagamento o seu restaurante aceita
      </p>

      <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-6">
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Formas de Pagamento Aceitas
            </h2>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Arraste para reordenar como aparecem no checkout. Use a caixa de
            seleção para ativar/desativar sem apagar. Você pode adicionar
            formas personalizadas (ex: Vale-Refeição, Sodexo) ou remover as
            que não usa.
          </p>
          <PaymentMethodsManager value={paymentMethods} onChange={setPaymentMethods} />
        </section>

        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Formas de Pagamento
        </button>
      </form>
    </div>
  );
}
