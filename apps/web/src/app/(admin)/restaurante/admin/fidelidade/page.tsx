"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Star, Users, Settings2 } from "lucide-react";

export default function FidelidadePage() {
  const [activeTab, setActiveTab] = useState<"config" | "customers">("config");

  // Config state
  const [isActive, setIsActive] = useState(false);
  const [spendingBase, setSpendingBase] = useState("1");
  const [pointsPerReal, setPointsPerReal] = useState("1");
  const [pointsName, setPointsName] = useState("Pontos");
  const [minOrderForPoints, setMinOrderForPoints] = useState("");
  const [neverExpires, setNeverExpires] = useState(false);
  const [pointsExpirationDays, setPointsExpirationDays] = useState("90");
  const [configLoaded, setConfigLoaded] = useState(false);

  const utils = trpc.useUtils();

  const { data: configData, isLoading: loadingConfig } =
    trpc.loyalty.getConfig.useQuery();

  if (configData && !configLoaded) {
    setIsActive(configData.isActive);
    setSpendingBase(configData.spendingBase ?? "1");
    setPointsPerReal(configData.pointsPerReal);
    setPointsName(configData.pointsName);
    setMinOrderForPoints(configData.minOrderForPoints ?? "");
    if (configData.pointsExpirationDays === null) {
      setNeverExpires(true);
    } else {
      setNeverExpires(false);
      setPointsExpirationDays(String(configData.pointsExpirationDays));
    }
    setConfigLoaded(true);
  }

  const { data: customerBalances, isLoading: loadingCustomers } =
    trpc.loyalty.listCustomerBalances.useQuery();

  const upsertConfig = trpc.loyalty.upsertConfig.useMutation({
    onSuccess: () => {
      utils.loyalty.getConfig.invalidate();
    },
  });

  function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();

    const newDays = neverExpires ? null : Number(pointsExpirationDays) || null;
    const oldDays = configData?.pointsExpirationDays ?? null;

    // Avisa quando muda o prazo: a regra é que pontos existentes não são afetados.
    if (configLoaded && newDays !== oldDays) {
      const fmt = (v: number | null) =>
        v === null ? "Nunca expira" : `${v} dias`;
      const ok = window.confirm(
        `Mudar a validade de "${fmt(oldDays)}" para "${fmt(newDays)}"?\n\n` +
          `Esta mudança vale apenas para pontos que serão creditados a partir de agora.\n` +
          `Pontos que o cliente já tem mantêm a validade original.\n\n` +
          `Confirma?`
      );
      if (!ok) return;
    }

    upsertConfig.mutate({
      isActive,
      spendingBase,
      pointsPerReal,
      pointsName,
      minOrderForPoints: minOrderForPoints || null,
      pointsExpirationDays: newDays,
    });
  }

  const tabs = [
    { id: "config" as const, label: "Configurar", icon: Settings2 },
    { id: "customers" as const, label: "Clientes", icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Star className="h-7 w-7 text-yellow-500" />
        <h1 className="text-2xl font-bold">Programa de Fidelidade</h1>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        Para oferecer produtos resgatáveis com pontos, vá em{" "}
        <span className="font-semibold">Produto &gt; Produtos</span> e defina um{" "}
        <span className="font-semibold">valor em pontos</span> ao lado do preço em R$.
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ======== Tab: Config ======== */}
      {activeTab === "config" && (
        <div className="rounded-xl border bg-card p-6">
          {loadingConfig ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-6">
              {/* Toggle ativo */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Sistema de Fidelidade</p>
                  <p className="text-sm text-muted-foreground">
                    Clientes ganham pontos a cada pedido e trocam por produtos
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    isActive ? "bg-primary" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                      isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Regra de pontos */}
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Nome dos pontos
                  </label>
                  <input
                    type="text"
                    value={pointsName}
                    onChange={(e) => setPointsName(e.target.value)}
                    placeholder="Ex: Pontos, Estrelas, Moedas"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Para cada R$ gastos
                    </label>
                    <input
                      type="number"
                      value={spendingBase}
                      onChange={(e) => setSpendingBase(e.target.value)}
                      step="0.01"
                      min="0.01"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Cliente ganha (pontos)
                    </label>
                    <input
                      type="number"
                      value={pointsPerReal}
                      onChange={(e) => setPointsPerReal(e.target.value)}
                      step="0.01"
                      min="0"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Valor mínimo do pedido para ganhar pontos (opcional)
                  </label>
                  <input
                    type="number"
                    value={minOrderForPoints}
                    onChange={(e) => setMinOrderForPoints(e.target.value)}
                    step="0.01"
                    min="0"
                    placeholder="Sem mínimo"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>

                {/* Validade dos pontos */}
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">Pontos nunca expiram</p>
                      <p className="text-xs text-muted-foreground">
                        Marque para que os pontos do cliente sejam acumulados sem
                        prazo de validade.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNeverExpires(!neverExpires)}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                        neverExpires ? "bg-primary" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                          neverExpires ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Validade dos pontos (dias)
                    </label>
                    <input
                      type="number"
                      value={pointsExpirationDays}
                      onChange={(e) => setPointsExpirationDays(e.target.value)}
                      step="1"
                      min="1"
                      max="3650"
                      placeholder="90"
                      disabled={neverExpires}
                      className="w-full rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pontos novos que o cliente ganhar a partir de agora vão
                      expirar após este prazo.{" "}
                      <strong>
                        Pontos já existentes mantêm a validade que tinham quando
                        foram ganhos
                      </strong>{" "}
                      — mudar este valor não afeta saldos atuais.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={upsertConfig.isPending}
                className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {upsertConfig.isPending
                  ? "Salvando..."
                  : upsertConfig.isSuccess
                    ? "Salvo!"
                    : "Salvar Configurações"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ======== Tab: Customers ======== */}
      {activeTab === "customers" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Clientes com saldo de pontos no seu restaurante
          </p>

          {loadingCustomers ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : !customerBalances || customerBalances.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="mb-2 text-lg font-semibold">Nenhum cliente</h2>
              <p className="text-sm text-muted-foreground">
                Quando clientes fizerem pedidos, seus pontos aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card">
              <div className="grid grid-cols-3 gap-4 border-b px-4 py-3 text-sm font-medium text-muted-foreground">
                <span>Telefone</span>
                <span className="text-center">Pontos</span>
                <span className="text-center">Pedidos</span>
              </div>
              {customerBalances.map((customer) => (
                <div
                  key={customer.customerPhone}
                  className="grid grid-cols-3 gap-4 border-b px-4 py-3 text-sm last:border-b-0"
                >
                  <span className="font-medium">{customer.customerPhone}</span>
                  <span className="text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-yellow-700">
                      <Star className="h-3 w-3" />
                      {customer.totalPoints}
                    </span>
                  </span>
                  <span className="text-center text-muted-foreground">
                    {customer.transactionCount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
