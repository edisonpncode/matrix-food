"use client";

import { useMemo, useState } from "react";
import {
  formatCurrency,
  round2,
  splitEvenly,
  type PaymentMethodCode,
  type PaymentMethodConfig,
} from "@matrix-food/utils";
import {
  ArrowLeft,
  Users,
  Receipt,
  Check,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  ChevronRight,
} from "lucide-react";
import type { POSCartItem } from "./pos-cart";

/** Forma de pagamento individual de uma pessoa. */
interface PersonForm {
  method: PaymentMethodCode;
  customLabel: string | null;
  amount: number;
  changeFor: number | null;
}

/** Pessoa que já confirmou seu pagamento. */
interface FinishedPerson {
  payerName: string;
  totalAmount: number;
  forms: PersonForm[];
}

/** Linha de pagamento final enviada ao backend (achatada). */
export interface SplitLineOut {
  method: PaymentMethodCode;
  customLabel: string | null;
  amount: number;
  payerName: string | null;
  changeFor: number | null;
}

interface POSSplitByPersonWizardProps {
  items: POSCartItem[];
  total: number;
  enabledMethods: PaymentMethodConfig[];
  onConfirm: (lines: SplitLineOut[]) => void;
  onCancel: () => void;
  isLoading: boolean;
}

type Phase =
  | "mode"
  | "equal-count"
  | "item-assign"
  | "person-payment"
  | "review";

type SplitMode = "by-item" | "by-equal";

/** Calcula o total real de um item do carrinho (espelha pos-cart.tsx). */
function getItemTotal(item: POSCartItem): number {
  const custTotal = item.customizations.reduce((s, c) => s + c.price, 0);
  const ingTotal = (item.ingredientModifications ?? []).reduce(
    (s, m) => s + m.price,
    0
  );
  return (item.unitPrice + custTotal + ingTotal) * item.quantity;
}

export function POSSplitByPersonWizard({
  items,
  total,
  enabledMethods,
  onConfirm,
  onCancel,
  isLoading,
}: POSSplitByPersonWizardProps) {
  const [phase, setPhase] = useState<Phase>("mode");
  const [mode, setMode] = useState<SplitMode | null>(null);
  const [peopleCount, setPeopleCount] = useState(2);

  // Modo "Por item": qual pessoa pagou qual item (itemId → personIdx, 1-based).
  // Item ainda não atribuído fica fora do dicionário.
  const [assignments, setAssignments] = useState<Record<string, number>>({});

  // Pessoa atual (1-based) — usada nos modos by-item e by-equal.
  const [currentPerson, setCurrentPerson] = useState(1);

  // Pessoas que já fecharam o pagamento.
  const [finishedPeople, setFinishedPeople] = useState<FinishedPerson[]>([]);

  // Distribuição igualitária — calculada quando mode=by-equal e peopleCount muda.
  const equalShares = useMemo(
    () => (mode === "by-equal" ? splitEvenly(total, peopleCount) : []),
    [mode, total, peopleCount]
  );

  // Subtotais por pessoa (modo by-item) — calculados a partir das atribuições.
  const itemSubtotals = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of items) {
      const personIdx = assignments[item.id];
      if (!personIdx) continue;
      map.set(personIdx, round2((map.get(personIdx) ?? 0) + getItemTotal(item)));
    }
    return map;
  }, [items, assignments]);

  // Itens ainda sem atribuição
  const unassignedItems = items.filter((i) => !assignments[i.id]);
  const allItemsAssigned = unassignedItems.length === 0;

  function handlePickMode(m: SplitMode) {
    setMode(m);
    if (m === "by-equal") {
      setPhase("equal-count");
    } else {
      setPhase("item-assign");
    }
  }

  function handleEqualCountConfirm() {
    setCurrentPerson(1);
    setFinishedPeople([]);
    setPhase("person-payment");
  }

  function handleItemAssignContinue() {
    // Se nada foi marcado pra essa pessoa, bloqueia.
    if ((itemSubtotals.get(currentPerson) ?? 0) <= 0) return;
    setPhase("person-payment");
  }

  function handlePersonPaymentConfirm(person: FinishedPerson) {
    const updatedFinished = [...finishedPeople, person];
    setFinishedPeople(updatedFinished);

    if (mode === "by-equal") {
      if (currentPerson >= peopleCount) {
        // Todas as pessoas pagaram
        finalize(updatedFinished);
      } else {
        setCurrentPerson(currentPerson + 1);
        // continua na fase de pagamento — só remonta com nova pessoa
      }
    } else {
      // by-item
      const stillUnassigned = items.some((i) => !assignments[i.id]);
      if (!stillUnassigned) {
        finalize(updatedFinished);
      } else {
        setCurrentPerson(currentPerson + 1);
        setPhase("item-assign");
      }
    }
  }

  function finalize(people: FinishedPerson[]) {
    const lines: SplitLineOut[] = people.flatMap((p) =>
      p.forms.map((f) => ({
        method: f.method,
        customLabel: f.customLabel,
        amount: f.amount,
        payerName: p.payerName.trim() ? p.payerName.trim() : null,
        changeFor: f.changeFor,
      }))
    );
    onConfirm(lines);
  }

  function toggleItemAssignment(itemId: string) {
    setAssignments((prev) => {
      const cur = prev[itemId];
      const next = { ...prev };
      if (cur === currentPerson) {
        delete next[itemId];
      } else if (!cur) {
        next[itemId] = currentPerson;
      }
      // se já é de outra pessoa, ignora
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {/* Header com botão voltar */}
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para forma única
      </button>

      {phase === "mode" && (
        <ModeStep
          total={total}
          itemCount={items.length}
          onPick={handlePickMode}
        />
      )}

      {phase === "equal-count" && (
        <EqualCountStep
          total={total}
          peopleCount={peopleCount}
          shares={equalShares}
          onChange={setPeopleCount}
          onConfirm={handleEqualCountConfirm}
          onBack={() => setPhase("mode")}
        />
      )}

      {phase === "item-assign" && (
        <ItemAssignStep
          items={items}
          assignments={assignments}
          currentPerson={currentPerson}
          finishedPeople={finishedPeople}
          subtotal={itemSubtotals.get(currentPerson) ?? 0}
          totalAssigned={Array.from(itemSubtotals.values()).reduce(
            (s, v) => s + v,
            0
          )}
          total={total}
          allAssigned={allItemsAssigned}
          onToggleItem={toggleItemAssignment}
          onContinue={handleItemAssignContinue}
          onBack={() => {
            // Limpa atribuições da pessoa atual e volta uma pessoa
            if (currentPerson === 1) {
              setAssignments({});
              setPhase("mode");
            } else {
              // Remove atribuições da pessoa atual
              setAssignments((prev) => {
                const next: Record<string, number> = {};
                for (const [k, v] of Object.entries(prev)) {
                  if (v !== currentPerson) next[k] = v;
                }
                return next;
              });
              // Volta uma pessoa e desfaz o último pagamento confirmado
              if (finishedPeople.length > 0) {
                setFinishedPeople((p) => p.slice(0, -1));
              }
              setCurrentPerson(currentPerson - 1);
            }
          }}
        />
      )}

      {phase === "person-payment" && (
        <PersonPaymentStep
          key={currentPerson}
          personIdx={currentPerson}
          totalPeople={mode === "by-equal" ? peopleCount : null}
          amount={
            mode === "by-equal"
              ? equalShares[currentPerson - 1] ?? 0
              : itemSubtotals.get(currentPerson) ?? 0
          }
          enabledMethods={enabledMethods}
          finishedCount={finishedPeople.length}
          onConfirm={handlePersonPaymentConfirm}
          onBack={() => {
            if (mode === "by-equal") {
              if (currentPerson === 1) {
                setPhase("equal-count");
              } else {
                // Volta uma pessoa: remove o último pagamento
                setFinishedPeople((p) => p.slice(0, -1));
                setCurrentPerson(currentPerson - 1);
              }
            } else {
              setPhase("item-assign");
            }
          }}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-componentes (steps)
// ============================================================

function ModeStep({
  total,
  itemCount,
  onPick,
}: {
  total: number;
  itemCount: number;
  onPick: (m: SplitMode) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="text-base font-semibold">Dividir entre pessoas</h3>
        <p className="text-xs text-muted-foreground">
          Total: {formatCurrency(total)} • {itemCount}{" "}
          {itemCount === 1 ? "item" : "itens"}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onPick("by-item")}
        className="w-full rounded-lg border-2 border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Por item</div>
            <p className="text-xs text-muted-foreground">
              Cada pessoa paga pelos produtos que consumiu.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </button>

      <button
        type="button"
        onClick={() => onPick("by-equal")}
        className="w-full rounded-lg border-2 border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Igualmente</div>
            <p className="text-xs text-muted-foreground">
              Total dividido em partes iguais entre N pessoas.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </button>
    </div>
  );
}

function EqualCountStep({
  total,
  peopleCount,
  shares,
  onChange,
  onConfirm,
  onBack,
}: {
  total: number;
  peopleCount: number;
  shares: number[];
  onChange: (n: number) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-base font-semibold">Dividir igualmente</h3>
        <p className="text-xs text-muted-foreground">
          Total a dividir: {formatCurrency(total)}
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <label className="block text-sm font-medium">
          Entre quantas pessoas?
        </label>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onChange(Math.max(2, peopleCount - 1))}
            className="rounded-md border-2 border-border w-10 h-10 flex items-center justify-center text-lg font-bold hover:border-primary"
            aria-label="Diminuir"
          >
            −
          </button>
          <input
            type="number"
            value={peopleCount}
            onChange={(e) =>
              onChange(Math.min(Math.max(parseInt(e.target.value) || 2, 2), 10))
            }
            min={2}
            max={10}
            className="w-20 rounded-md border-2 border-border px-3 py-2 text-center text-2xl font-bold focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={() => onChange(Math.min(10, peopleCount + 1))}
            className="rounded-md border-2 border-border w-10 h-10 flex items-center justify-center text-lg font-bold hover:border-primary"
            aria-label="Aumentar"
          >
            +
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Mínimo 2, máximo 10
        </p>
      </div>

      {/* Preview da divisão */}
      <div className="rounded-lg bg-accent/30 p-3 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          Cada pessoa pagará:
        </p>
        {shares.map((s, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between text-sm"
          >
            <span>Pessoa {idx + 1}</span>
            <span className="font-semibold">{formatCurrency(s)}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border-2 border-border py-2.5 text-sm font-semibold hover:bg-accent"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-[2] rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}

function ItemAssignStep({
  items,
  assignments,
  currentPerson,
  finishedPeople,
  subtotal,
  totalAssigned,
  total,
  allAssigned,
  onToggleItem,
  onContinue,
  onBack,
}: {
  items: POSCartItem[];
  assignments: Record<string, number>;
  currentPerson: number;
  finishedPeople: FinishedPerson[];
  subtotal: number;
  totalAssigned: number;
  total: number;
  allAssigned: boolean;
  onToggleItem: (itemId: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const remaining = round2(total - totalAssigned);

  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="text-base font-semibold">
          Itens da Pessoa {currentPerson}
        </h3>
        <p className="text-xs text-muted-foreground">
          Marque os produtos que esta pessoa vai pagar
        </p>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {items.map((item) => {
          const assignedTo = assignments[item.id];
          const isMine = assignedTo === currentPerson;
          const isOthers = assignedTo && assignedTo !== currentPerson;
          const itemTotal = (() => {
            const custTotal = item.customizations.reduce(
              (s, c) => s + c.price,
              0
            );
            const ingTotal = (item.ingredientModifications ?? []).reduce(
              (s, m) => s + m.price,
              0
            );
            return (item.unitPrice + custTotal + ingTotal) * item.quantity;
          })();

          return (
            <button
              key={item.id}
              type="button"
              disabled={!!isOthers}
              onClick={() => onToggleItem(item.id)}
              className={`w-full rounded-lg border-2 p-3 text-left transition-colors ${
                isMine
                  ? "border-primary bg-primary/10"
                  : isOthers
                    ? "border-border bg-muted/40 opacity-60 cursor-not-allowed"
                    : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 ${
                    isMine
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40"
                  }`}
                >
                  {isMine && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      {item.quantity}× {item.productName}
                      {item.variantName ? ` (${item.variantName})` : ""}
                    </span>
                    <span className="text-sm font-semibold flex-shrink-0">
                      {formatCurrency(itemTotal)}
                    </span>
                  </div>
                  {isOthers && (
                    <p className="text-xs text-muted-foreground">
                      Pessoa {assignedTo}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Resumo */}
      <div className="rounded-lg bg-accent/30 p-3 space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Subtotal Pessoa {currentPerson}
          </span>
          <span className="font-semibold text-primary">
            {formatCurrency(subtotal)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Falta atribuir</span>
          <span>{formatCurrency(remaining)}</span>
        </div>
        {finishedPeople.length > 0 && (
          <div className="border-t border-border pt-1.5">
            {finishedPeople.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs text-muted-foreground"
              >
                <span>Pessoa {idx + 1} ✓</span>
                <span>{formatCurrency(p.totalAmount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border-2 border-border py-2.5 text-sm font-semibold hover:bg-accent"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={subtotal <= 0}
          className="flex-[2] rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          Pagamento Pessoa {currentPerson} →
        </button>
      </div>

      {!allAssigned && subtotal <= 0 && (
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 flex items-start gap-1">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          Marque ao menos um item para continuar.
        </p>
      )}
    </div>
  );
}

interface PaymentLineDraft {
  uid: string;
  methodId: string;
  amount: string;
  changeFor: string;
}

function PersonPaymentStep({
  personIdx,
  totalPeople,
  amount,
  enabledMethods,
  finishedCount,
  onConfirm,
  onBack,
  isLoading,
}: {
  personIdx: number;
  totalPeople: number | null;
  amount: number;
  enabledMethods: PaymentMethodConfig[];
  finishedCount: number;
  onConfirm: (p: FinishedPerson) => void;
  onBack: () => void;
  isLoading: boolean;
}) {
  const initialMethodId =
    enabledMethods.find((m) => m.code === "CASH")?.id ??
    enabledMethods[0]?.id ??
    "";

  // Modo simples
  const [payerName, setPayerName] = useState("");
  const [methodId, setMethodId] = useState(initialMethodId);
  const [changeFor, setChangeFor] = useState("");

  // Modo "+ dividir em formas" desta pessoa
  const [multi, setMulti] = useState(false);
  const [lines, setLines] = useState<PaymentLineDraft[]>([]);

  function enterMulti() {
    if (lines.length === 0) {
      setLines([
        {
          uid: Math.random().toString(36).slice(2, 10),
          methodId: initialMethodId,
          amount: amount.toFixed(2),
          changeFor: "",
        },
        {
          uid: Math.random().toString(36).slice(2, 10),
          methodId: initialMethodId,
          amount: "0.00",
          changeFor: "",
        },
      ]);
    }
    setMulti(true);
  }

  function addLine() {
    if (lines.length >= 5) return;
    setLines((prev) => [
      ...prev,
      {
        uid: Math.random().toString(36).slice(2, 10),
        methodId: initialMethodId,
        amount: "0.00",
        changeFor: "",
      },
    ]);
  }

  function removeLine(uid: string) {
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((l) => l.uid !== uid)));
  }

  function updateLine(uid: string, patch: Partial<PaymentLineDraft>) {
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  }

  const linesSum = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const linesDiff = round2(amount - linesSum);
  const linesOk = multi && Math.abs(linesDiff) <= 0.01 && lines.length >= 2;
  const selectedMethod = enabledMethods.find((m) => m.id === methodId);

  function handleConfirm() {
    if (multi) {
      if (!linesOk) return;
      const forms: PersonForm[] = lines.map((l) => {
        const cfg = enabledMethods.find((m) => m.id === l.methodId);
        if (!cfg) throw new Error("Forma inválida");
        const cf = parseFloat(l.changeFor);
        return {
          method: cfg.code,
          customLabel: cfg.code === "OTHER" ? cfg.label : null,
          amount: round2(parseFloat(l.amount) || 0),
          changeFor:
            cfg.code === "CASH" && !Number.isNaN(cf) && cf > 0
              ? round2(cf)
              : null,
        };
      });
      onConfirm({
        payerName: payerName || `Pessoa ${personIdx}`,
        totalAmount: amount,
        forms,
      });
      return;
    }

    if (!selectedMethod) return;
    const cf = parseFloat(changeFor);
    onConfirm({
      payerName: payerName || `Pessoa ${personIdx}`,
      totalAmount: amount,
      forms: [
        {
          method: selectedMethod.code,
          customLabel:
            selectedMethod.code === "OTHER" ? selectedMethod.label : null,
          amount: round2(amount),
          changeFor:
            selectedMethod.code === "CASH" &&
            !Number.isNaN(cf) &&
            cf > 0
              ? round2(cf)
              : null,
        },
      ],
    });
  }

  const canSubmit = multi ? linesOk : !!selectedMethod;

  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="text-base font-semibold">
          Pessoa {personIdx}
          {totalPeople ? ` de ${totalPeople}` : ""}
        </h3>
        <p className="text-2xl font-bold text-primary mt-1">
          {formatCurrency(amount)}
        </p>
        {finishedCount > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {finishedCount}{" "}
            {finishedCount === 1 ? "pessoa pagou" : "pessoas pagaram"}
          </p>
        )}
      </div>

      <input
        type="text"
        value={payerName}
        onChange={(e) => setPayerName(e.target.value)}
        placeholder={`Nome da pessoa ${personIdx} (opcional)`}
        maxLength={100}
        className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />

      {!multi ? (
        <>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">
              Forma de Pagamento
            </label>
            {enabledMethods.length > 0 && (
              <button
                type="button"
                onClick={enterMulti}
                className="text-xs font-medium text-primary hover:underline"
              >
                + Dividir em formas
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {enabledMethods.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMethodId(opt.id)}
                className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                  methodId === opt.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {selectedMethod?.code === "CASH" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Troco para (R$)
              </label>
              <input
                type="number"
                value={changeFor}
                onChange={(e) => setChangeFor(e.target.value)}
                placeholder="Sem troco"
                step="0.01"
                min="0"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMulti(false)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar para uma forma
            </button>
            <span className="text-xs font-medium">Dividir em formas</span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {lines.map((line, idx) => {
              const cfg = enabledMethods.find((m) => m.id === line.methodId);
              const isCash = cfg?.code === "CASH";
              return (
                <div
                  key={line.uid}
                  className="rounded-lg border border-border p-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Forma {idx + 1}
                    </span>
                    {lines.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeLine(line.uid)}
                        className="text-muted-foreground hover:text-red-600"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-[1fr_100px] gap-2">
                    <select
                      value={line.methodId}
                      onChange={(e) =>
                        updateLine(line.uid, { methodId: e.target.value })
                      }
                      className="rounded-md border px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                    >
                      {enabledMethods.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.amount}
                      onChange={(e) =>
                        updateLine(line.uid, { amount: e.target.value })
                      }
                      placeholder="0,00"
                      className="rounded-md border px-2 py-1.5 text-sm text-right focus:border-primary focus:outline-none"
                    />
                  </div>
                  {isCash && (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.changeFor}
                      onChange={(e) =>
                        updateLine(line.uid, { changeFor: e.target.value })
                      }
                      placeholder="Troco para (opcional)"
                      className="w-full rounded-md border px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {lines.length < 5 && (
            <button
              type="button"
              onClick={addLine}
              className="flex w-full items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar forma
            </button>
          )}

          <div
            className={`flex items-center gap-2 rounded-lg p-2 text-xs ${
              linesOk
                ? "bg-green-50 text-green-700"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            {linesOk ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
            )}
            <div className="flex-1 flex items-center justify-between">
              <span>
                {linesOk
                  ? "Total fechado"
                  : linesDiff > 0
                    ? `Falta ${formatCurrency(linesDiff)}`
                    : `Excede ${formatCurrency(Math.abs(linesDiff))}`}
              </span>
              <span className="font-medium">
                {formatCurrency(linesSum)} / {formatCurrency(amount)}
              </span>
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border-2 border-border py-2.5 text-sm font-semibold hover:bg-accent"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isLoading || !canSubmit}
          className="flex-[2] rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading
            ? "Processando..."
            : `Confirmar Pessoa ${personIdx} →`}
        </button>
      </div>
    </div>
  );
}
