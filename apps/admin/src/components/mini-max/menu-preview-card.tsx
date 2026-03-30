"use client";

import { ClipboardList, AlertTriangle, Loader2 } from "lucide-react";
import type { ExtractedMenu } from "@/lib/ai/tools";

interface MenuPreviewCardProps {
  menu: ExtractedMenu;
  onConfirm: () => void;
  onCancel: () => void;
  isImporting: boolean;
}

function formatPrice(price: string): string {
  return Number(price).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function MenuPreviewCard({
  menu,
  onConfirm,
  onCancel,
  isImporting,
}: MenuPreviewCardProps) {
  const totalProducts = menu.categories.reduce(
    (sum, cat) => sum + cat.products.length,
    0
  );

  return (
    <div className="my-3 ml-11 overflow-hidden rounded-xl border-2 border-primary/30 bg-card shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-2 bg-primary/5 px-4 py-3">
        <ClipboardList className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Cardápio Extraído</span>
        <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {menu.categories.length} categorias, {totalProducts} produtos
        </span>
      </div>

      {/* Body */}
      <div className="max-h-80 overflow-y-auto px-4 py-3">
        {menu.categories.map((category, catIdx) => (
          <div key={catIdx} className={catIdx > 0 ? "mt-4" : ""}>
            <h4 className="text-sm font-bold text-foreground">
              {category.name}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({category.products.length} {category.products.length === 1 ? "item" : "itens"})
              </span>
            </h4>
            {category.description && (
              <p className="text-xs text-muted-foreground">{category.description}</p>
            )}
            <div className="mt-1.5 space-y-1">
              {category.products.map((product, prodIdx) => (
                <div
                  key={prodIdx}
                  className="flex items-baseline justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="text-foreground">{product.name}</span>
                    {product.description && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        — {product.description}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 font-medium text-primary">
                    {formatPrice(product.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Notes */}
        {menu.notes && (
          <div className="mt-4 flex gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{menu.notes}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
        <button
          onClick={onCancel}
          disabled={isImporting}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={isImporting}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isImporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importando...
            </>
          ) : (
            "Importar Cardápio"
          )}
        </button>
      </div>
    </div>
  );
}
