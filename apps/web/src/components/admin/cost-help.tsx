"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

type HelpTopic = "waste" | "margin" | "unit" | "composite";

const HELP_CONTENT: Record<HelpTopic, { title: string; body: React.ReactNode }> = {
  waste: {
    title: "O que é perda no processo?",
    body: (
      <>
        <p className="mb-2">
          É o quanto se perde do ingrediente durante o preparo: casca de cebola,
          gordura aparada do bife, evaporação ao ferver, queijo que gruda no
          ralador. <strong>Não é desperdício</strong> — é o que sai do
          ingrediente sem virar venda.
        </p>
        <p className="font-semibold mt-3 mb-1">Exemplos práticos:</p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li>Queijo ralado: ~5% (sobra no ralador)</li>
          <li>Alho descascado: ~15% (a casca pesa)</li>
          <li>Bife aparado: ~10% (gordura cortada)</li>
          <li>Cebola picada: ~8% (casca + ponta)</li>
          <li>Pão pré-cortado: ~0% (sem perda)</li>
        </ul>
        <p className="mt-3 text-xs">
          <strong>Por que isso importa?</strong> Se você compra 1kg de queijo
          por R$30 mas perde 50g (5%), cada grama efetivamente usável custa
          R$0,0316 e não R$0,0300. Sem ajustar a perda, você subestima o custo.
        </p>
      </>
    ),
  },
  margin: {
    title: "Margem vs Markup — qual é a diferença?",
    body: (
      <>
        <p className="mb-2">
          <strong>Margem (%):</strong> quanto sobra de cada R$1 vendido. Foco no
          lucro. <em>Margem = lucro / preço de venda</em>.
        </p>
        <p className="mb-2">
          <strong>Markup (%):</strong> quanto você cobra acima do custo. Foco no
          preço. <em>Markup = lucro / custo</em>.
        </p>
        <p className="mb-2 text-xs italic">
          Ex: produto custa R$10 e vende por R$25 → lucro R$15. Margem = 60%
          (sobra 60¢ de cada R$1). Markup = 150% (cobra 1,5× o custo).
        </p>
        <p className="font-semibold mt-3 mb-1">Benchmarks por segmento:</p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li>Lanchonete: margem 50% a 70%</li>
          <li>Pizzaria: margem 65% a 75%</li>
          <li>Hamburgueria gourmet: margem 60% a 70%</li>
          <li>Restaurante self-service: margem 55% a 65%</li>
        </ul>
      </>
    ),
  },
  unit: {
    title: "Como escolher a unidade?",
    body: (
      <>
        <p className="mb-2">
          Cadastre o ingrediente na unidade que você <strong>usa</strong>, não
          na que compra. O sistema converte automaticamente quando preciso.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs mb-2">
          <li>
            <strong>g (gramas):</strong> queijo, carne, farinha, tempero
          </li>
          <li>
            <strong>ml (mililitros):</strong> azeite, leite, óleo, vinagre
          </li>
          <li>
            <strong>un (unidade):</strong> ovo, hambúrguer pré-pronto, embalagem
          </li>
        </ul>
        <p className="text-xs">
          Compras em <strong>kg</strong> ou <strong>L</strong> são convertidas
          para g/ml automaticamente: 1kg = 1000g, 1L = 1000ml.
        </p>
      </>
    ),
  },
  composite: {
    title: "O que é uma sub-receita?",
    body: (
      <>
        <p className="mb-2">
          É um ingrediente que você <strong>prepara</strong> antes de usar nos
          produtos. Em vez de cadastrar como ingrediente comum (com preço fixo),
          o sistema calcula o custo automaticamente a partir dos componentes.
        </p>
        <p className="font-semibold mt-3 mb-1">Exemplos:</p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li>
            <strong>Massa de pizza</strong>: farinha + água + fermento + sal
          </li>
          <li>
            <strong>Bife marinado</strong>: bife + tempero + sal
          </li>
          <li>
            <strong>Molho da casa</strong>: tomate + alho + cebola + azeite
          </li>
        </ul>
        <p className="mt-3 text-xs">
          <strong>Vantagem:</strong> quando o preço da farinha sobe, o custo da
          massa atualiza sozinho — e o custo de todas as pizzas que usam essa
          massa também.
        </p>
      </>
    ),
  },
};

export function CostHelp({ topic }: { topic: HelpTopic }) {
  const [open, setOpen] = useState(false);
  const content = HELP_CONTENT[topic];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
        title={content.title}
        aria-label={content.title}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-foreground">
                {content.title}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="text-sm text-foreground leading-relaxed">
              {content.body}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Pill colorido com a margem do produto.
 * verde > 60% / amarelo 30-60% / vermelho < 30% / cinza não-calculado
 */
export function MarginBadge({
  marginPercent,
  cost,
}: {
  marginPercent: number | null;
  cost: number;
}) {
  if (cost <= 0 || marginPercent == null) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Custo não cadastrado
      </span>
    );
  }

  let cls = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  if (marginPercent >= 60) {
    cls = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  } else if (marginPercent >= 30) {
    cls = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      Margem {marginPercent.toFixed(1)}%
    </span>
  );
}

/**
 * Helper: converte input do usuário (kg / L) para unidade-base (g / ml / un).
 * Retorna { quantity: number_em_unidade_base, unit: 'g' | 'ml' | 'un' }
 */
export function convertToBaseUnit(
  rawQuantity: string | number,
  inputUnit: "kg" | "g" | "L" | "ml" | "un" | "pacote"
): { quantity: number; unit: "g" | "ml" | "un" } {
  const qty = typeof rawQuantity === "number" ? rawQuantity : Number(rawQuantity);
  const safeQty = Number.isFinite(qty) ? qty : 0;

  switch (inputUnit) {
    case "kg":
      return { quantity: safeQty * 1000, unit: "g" };
    case "g":
      return { quantity: safeQty, unit: "g" };
    case "L":
      return { quantity: safeQty * 1000, unit: "ml" };
    case "ml":
      return { quantity: safeQty, unit: "ml" };
    case "un":
    case "pacote":
      return { quantity: safeQty, unit: "un" };
  }
}

/**
 * Helper inverso: dada uma quantidade na unidade-base, sugere a unidade
 * "humana" mais conveniente para exibição (kg/L se o número for grande).
 */
export function displayInPreferredUnit(
  baseQuantity: number,
  baseUnit: "g" | "ml" | "un"
): { value: number; label: string } {
  if (baseUnit === "g" && baseQuantity >= 1000) {
    return { value: baseQuantity / 1000, label: "kg" };
  }
  if (baseUnit === "ml" && baseQuantity >= 1000) {
    return { value: baseQuantity / 1000, label: "L" };
  }
  return { value: baseQuantity, label: baseUnit };
}
