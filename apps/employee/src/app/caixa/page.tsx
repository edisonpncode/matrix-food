"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import {
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  Lock,
  Unlock,
  X,
  Printer,
} from "lucide-react";

type TransactionModalType = "WITHDRAWAL" | "DEPOSIT" | null;

type Breakdown = {
  cash: string;
  creditCard: string;
  debitCard: string;
  pix: string;
};

const EMPTY_BREAKDOWN: Breakdown = { cash: "", creditCard: "", debitCard: "", pix: "" };

type CloseStep = "count" | "review" | null;

type CloseResult = {
  expectedBreakdown: Breakdown;
  countedBreakdown: Breakdown;
  sessionId: string;
};

export default function CaixaPage() {
  const [openingBalance, setOpeningBalance] = useState("");
  const [txModalType, setTxModalType] = useState<TransactionModalType>(null);
  const [txAmount, setTxAmount] = useState("");
  const [txDescription, setTxDescription] = useState("");

  const [closeStep, setCloseStep] = useState<CloseStep>(null);
  const [counted, setCounted] = useState<Breakdown>(EMPTY_BREAKDOWN);
  const [closeResult, setCloseResult] = useState<CloseResult | null>(null);

  const utils = trpc.useUtils();

  const { data: activeSession, isLoading } =
    trpc.cashRegister.getActiveSession.useQuery();

  const { data: sessionSummary } = trpc.cashRegister.getSessionSummary.useQuery(
    { sessionId: activeSession?.id ?? "" },
    { enabled: !!activeSession }
  );

  const { data: printerSettings } = trpc.tenant.getPrinterSettings.useQuery(
    undefined,
    { enabled: !!activeSession }
  );

  const openSession = trpc.cashRegister.openSession.useMutation({
    onSuccess: () => {
      utils.cashRegister.getActiveSession.invalidate();
      setOpeningBalance("");
    },
  });

  const closeSession = trpc.cashRegister.closeSession.useMutation({
    onSuccess: (data) => {
      setCloseResult({
        sessionId: data.session.id,
        expectedBreakdown: data.expectedBreakdown,
        countedBreakdown: data.countedBreakdown,
      });
      setCloseStep("review");
      // Invalida activeSession só depois do usuário confirmar (handleFinishClose),
      // para o modal de revisão não sumir com a mudança de estado.
    },
  });

  const printClosing = trpc.print.sendCashClosingToNetwork.useMutation();

  const addTransaction = trpc.cashRegister.addTransaction.useMutation({
    onSuccess: () => {
      utils.cashRegister.getSessionSummary.invalidate();
      setTxModalType(null);
      setTxAmount("");
      setTxDescription("");
    },
  });

  function handleOpenSession(e: React.FormEvent) {
    e.preventDefault();
    openSession.mutate({ openingBalance: openingBalance || "0" });
  }

  function handleSubmitCount(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSession) return;
    closeSession.mutate({
      sessionId: activeSession.id,
      counted: {
        cash: counted.cash || "0",
        creditCard: counted.creditCard || "0",
        debitCard: counted.debitCard || "0",
        pix: counted.pix || "0",
      },
    });
    // Step muda pra "review" no onSuccess.
  }

  function resetCloseFlow() {
    setCloseStep(null);
    setCounted(EMPTY_BREAKDOWN);
    setCloseResult(null);
    closeSession.reset();
  }

  function handleFinishClose() {
    if (printerSettings?.printers && closeResult) {
      const defaultPrinter =
        printerSettings.printers.find((p) => p.isDefault && p.isActive) ??
        printerSettings.printers.find((p) => p.isActive);
      if (defaultPrinter && defaultPrinter.connectionMethod === "NETWORK") {
        printClosing.mutate({
          sessionId: closeResult.sessionId,
          printerId: defaultPrinter.id,
        });
      }
    }
    utils.cashRegister.getActiveSession.invalidate();
    resetCloseFlow();
  }

  function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSession || !txModalType || !txAmount) return;
    addTransaction.mutate({
      sessionId: activeSession.id,
      type: txModalType,
      amount: txAmount,
      description: txDescription || undefined,
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="text-2xl font-bold">Caixa</h1>

        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <Lock className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-bold">Caixa Fechado</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Abra o caixa para iniciar as operações
          </p>

          <form onSubmit={handleOpenSession} className="space-y-4">
            <div className="text-left">
              <label className="mb-1 block text-sm font-medium">
                Saldo Inicial (R$)
              </label>
              <input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0,00"
                step="0.01"
                min="0"
                className="w-full rounded-lg border px-4 py-3 text-lg"
              />
            </div>
            <button
              type="submit"
              disabled={openSession.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-4 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Unlock className="h-5 w-5" />
              Abrir Caixa
            </button>
          </form>
        </div>
      </div>
    );
  }

  const summary = sessionSummary?.summary;
  const transactions = sessionSummary?.transactions ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Caixa</h1>
        <span className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
          <Unlock className="h-4 w-4" />
          Aberto
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Saldo Abertura</p>
          <p className="text-xl font-bold">
            {formatCurrency(summary?.openingBalance ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border bg-green-50 p-4">
          <p className="text-sm text-green-600">Vendas</p>
          <p className="text-xl font-bold text-green-700">
            +{formatCurrency(summary?.totalSales ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border bg-red-50 p-4">
          <p className="text-sm text-red-600">Retiradas</p>
          <p className="text-xl font-bold text-red-700">
            -{formatCurrency(summary?.totalWithdrawals ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border bg-primary/10 p-4">
          <p className="text-sm text-primary">Saldo Atual</p>
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(summary?.currentBalance ?? 0)}
          </p>
        </div>
      </div>

      {((summary?.totalDeposits ?? 0) > 0 ||
        (summary?.totalRefunds ?? 0) < 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(summary?.totalDeposits ?? 0) > 0 && (
            <div className="rounded-xl border bg-blue-50 p-4">
              <p className="text-sm text-blue-600">Depósitos</p>
              <p className="text-xl font-bold text-blue-700">
                +{formatCurrency(summary?.totalDeposits ?? 0)}
              </p>
            </div>
          )}
          {(summary?.totalRefunds ?? 0) < 0 && (
            <div className="rounded-xl border bg-orange-50 p-4">
              <p className="text-sm text-orange-600">Estornos</p>
              <p className="text-xl font-bold text-orange-700">
                {formatCurrency(summary?.totalRefunds ?? 0)}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setTxModalType("WITHDRAWAL")}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-red-200 p-4 text-red-600 hover:bg-red-50 active:bg-red-100"
        >
          <ArrowUpCircle className="h-8 w-8" />
          <span className="text-sm font-medium">Retirada</span>
        </button>
        <button
          onClick={() => setTxModalType("DEPOSIT")}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-blue-200 p-4 text-blue-600 hover:bg-blue-50 active:bg-blue-100"
        >
          <ArrowDownCircle className="h-8 w-8" />
          <span className="text-sm font-medium">Depósito</span>
        </button>
        <button
          onClick={() => {
            setCounted(EMPTY_BREAKDOWN);
            setCloseStep("count");
          }}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-border p-4 text-muted-foreground hover:bg-accent"
        >
          <Lock className="h-8 w-8" />
          <span className="text-sm font-medium">Fechar Caixa</span>
        </button>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">Movimentações</h2>
        {transactions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhuma movimentação registrada.
          </p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      tx.type === "SALE"
                        ? "bg-green-100 text-green-600"
                        : tx.type === "WITHDRAWAL"
                          ? "bg-red-100 text-red-600"
                          : tx.type === "DEPOSIT"
                            ? "bg-blue-100 text-blue-600"
                            : tx.type === "REFUND"
                              ? "bg-orange-100 text-orange-600"
                              : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {tx.type === "SALE"
                        ? "Venda"
                        : tx.type === "WITHDRAWAL"
                          ? "Retirada"
                          : tx.type === "DEPOSIT"
                            ? "Depósito"
                            : tx.type === "REFUND"
                              ? "Estorno"
                              : "Ajuste"}
                    </p>
                    {tx.description && (
                      <p className="text-xs text-muted-foreground">
                        {tx.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-bold ${
                      parseFloat(tx.amount) < 0 || tx.type === "WITHDRAWAL"
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {parseFloat(tx.amount) < 0
                      ? ""
                      : tx.type === "WITHDRAWAL"
                        ? "-"
                        : "+"}
                    {formatCurrency(parseFloat(tx.amount))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction Modal */}
      {txModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {txModalType === "WITHDRAWAL" ? "Retirada" : "Depósito"}
              </h3>
              <button
                onClick={() => setTxModalType(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="0,00"
                  step="0.01"
                  min="0.01"
                  required
                  className="w-full rounded-lg border px-4 py-3 text-lg"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="Ex: Troco para o caixa"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={addTransaction.isPending}
                className={`w-full rounded-lg py-3 text-base font-semibold text-white disabled:opacity-50 ${
                  txModalType === "WITHDRAWAL"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {addTransaction.isPending
                  ? "Processando..."
                  : `Confirmar ${
                      txModalType === "WITHDRAWAL" ? "Retirada" : "Depósito"
                    }`}
              </button>
            </form>
          </div>
        </div>
      )}

      {closeStep === "count" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Fechar Caixa · Contagem</h3>
              <button
                onClick={resetCloseFlow}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              Informe os valores que você contou, sem consultar o sistema. As
              diferenças serão mostradas após confirmar.
            </p>

            <form onSubmit={handleSubmitCount} className="space-y-3">
              {(
                [
                  ["cash", "Dinheiro"],
                  ["creditCard", "Crédito"],
                  ["debitCard", "Débito"],
                  ["pix", "PIX"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="mb-1 block text-sm font-medium">
                    {label} (R$)
                  </label>
                  <input
                    type="number"
                    value={counted[key]}
                    onChange={(e) =>
                      setCounted((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder="0,00"
                    step="0.01"
                    min="0"
                    className="w-full rounded-lg border px-4 py-3 text-lg"
                  />
                </div>
              ))}

              {closeSession.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {closeSession.error.message}
                </div>
              )}

              <button
                type="submit"
                disabled={closeSession.isPending}
                className="mt-2 w-full rounded-lg bg-primary py-3 text-base font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {closeSession.isPending ? "Processando..." : "Continuar"}
              </button>
            </form>
          </div>
        </div>
      )}

      {closeStep === "review" && closeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Fechamento Confirmado</h3>
              <button
                onClick={handleFinishClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <DifferencesTable result={closeResult} />

            <button
              onClick={handleFinishClose}
              disabled={printClosing.isPending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-base font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Printer className="h-5 w-5" />
              {printClosing.isPending
                ? "Imprimindo..."
                : "Imprimir e Concluir"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DifferencesTable({ result }: { result: CloseResult }) {
  const rows: Array<[string, keyof Breakdown]> = [
    ["Dinheiro", "cash"],
    ["Crédito", "creditCard"],
    ["Débito", "debitCard"],
    ["PIX", "pix"],
  ];

  const totals = rows.reduce(
    (acc, [, key]) => {
      acc.expected += parseFloat(result.expectedBreakdown[key] || "0");
      acc.counted += parseFloat(result.countedBreakdown[key] || "0");
      return acc;
    },
    { expected: 0, counted: 0 }
  );
  const totalDiff = totals.counted - totals.expected;

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="p-2 text-left font-semibold">Método</th>
            <th className="p-2 text-right font-semibold">Esperado</th>
            <th className="p-2 text-right font-semibold">Contado</th>
            <th className="p-2 text-right font-semibold">Diferença</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, key]) => {
            const expected = parseFloat(result.expectedBreakdown[key] || "0");
            const counted = parseFloat(result.countedBreakdown[key] || "0");
            const diff = counted - expected;
            return (
              <tr key={key} className="border-t">
                <td className="p-2">{label}</td>
                <td className="p-2 text-right">{formatCurrency(expected)}</td>
                <td className="p-2 text-right">{formatCurrency(counted)}</td>
                <td
                  className={`p-2 text-right font-semibold ${
                    Math.abs(diff) < 0.005
                      ? "text-green-600"
                      : diff < 0
                        ? "text-red-600"
                        : "text-amber-600"
                  }`}
                >
                  {formatCurrency(diff)}
                </td>
              </tr>
            );
          })}
          <tr className="border-t bg-muted/50 font-bold">
            <td className="p-2">Total</td>
            <td className="p-2 text-right">{formatCurrency(totals.expected)}</td>
            <td className="p-2 text-right">{formatCurrency(totals.counted)}</td>
            <td
              className={`p-2 text-right ${
                Math.abs(totalDiff) < 0.005
                  ? "text-green-600"
                  : totalDiff < 0
                    ? "text-red-600"
                    : "text-amber-600"
              }`}
            >
              {formatCurrency(totalDiff)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
