"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Plus,
  Minus,
  Trash2,
  Loader2,
  Printer,
  Search,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@matrix-food/utils";
import { trpc } from "@/lib/trpc";
import { usePrinterSettings } from "@/hooks/use-printer-settings";
import { printChangesViaIframe } from "@/lib/print-changes";
import type {
  OrderItemSnapshot,
  PendingChange,
} from "@/lib/print-changes";

interface OrderEditModalProps {
  orderId: string;
  onClose: () => void;
  onChanged?: () => void;
}

type ProductLite = {
  id: string;
  name: string;
  price: string;
  imageUrl: string | null;
  hasVariants: boolean;
  variants: Array<{ id: string; name: string; price: string; isActive: boolean }>;
};

function paymentLabel(method: string): string {
  switch (method) {
    case "CASH":
      return "Dinheiro";
    case "PIX":
      return "PIX";
    case "CREDIT_CARD":
      return "Crédito";
    case "DEBIT_CARD":
      return "Débito";
    default:
      return method;
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "DELIVERY":
      return "Entrega";
    case "PICKUP":
      return "Retirada";
    case "COUNTER":
      return "Balcão";
    case "TABLE":
      return "Mesa";
    case "DINE_IN":
      return "Consumo";
    default:
      return type;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "CONFIRMED":
      return "Confirmado";
    case "PREPARING":
      return "Preparando";
    case "READY":
      return "Pronto";
    case "OUT_FOR_DELIVERY":
      return "Entregando";
    case "DELIVERED":
      return "Finalizado";
    case "PICKED_UP":
      return "Retirado";
    case "CANCELLED":
      return "Cancelado";
    default:
      return status;
  }
}

/**
 * Constrói um snapshot canônico do item para comparações de mudança.
 * O snapshot inclui todas as informações relevantes para o destaque na reimpressão.
 */
function snapshotFromItem(item: {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  notes: string | null;
  customizations: Array<{ customizationOptionName: string; price: string }>;
  ingredientModifications: Array<{
    modification: string;
    price: string;
  }>;
}): OrderItemSnapshot {
  return {
    id: item.id,
    productName: item.productName,
    variantName: item.variantName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    notes: item.notes,
    customizations: item.customizations.map((c) => ({
      name: c.customizationOptionName,
      price: c.price,
    })),
    ingredientModifications: item.ingredientModifications.map((i) => ({
      modification: i.modification,
      price: i.price,
    })),
  };
}

export function OrderEditModal({ orderId, onClose, onChanged }: OrderEditModalProps) {
  const utils = trpc.useUtils();
  const { data: order, isLoading, refetch } = trpc.order.getDetails.useQuery(
    { orderId },
    { refetchOnWindowFocus: false }
  );

  const productsQuery = trpc.product.listForPOS.useQuery();
  const { data: tenant } = trpc.tenant.getById.useQuery();

  const {
    settings: printerSettings,
    restaurantName,
  } = usePrinterSettings();

  // Snapshot inicial — capturado quando o modal abre. Usado para destacar
  // mudanças na reimpressão. Resetado após cada reimpressão.
  const [baseSnapshots, setBaseSnapshots] = useState<OrderItemSnapshot[]>([]);
  const [snapshotsReady, setSnapshotsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Painel "adicionar produto"
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [addQuantity, setAddQuantity] = useState(1);
  const [addNotes, setAddNotes] = useState("");

  useEffect(() => {
    if (order && !snapshotsReady) {
      const snaps = order.items.map((it) =>
        snapshotFromItem({
          ...it,
          customizations: it.customizations ?? [],
          ingredientModifications: it.ingredientModifications ?? [],
        })
      );
      setBaseSnapshots(snaps);
      setSnapshotsReady(true);
    }
  }, [order, snapshotsReady]);

  const isLocked =
    !!order &&
    (order.status === "DELIVERED" ||
      order.status === "PICKED_UP" ||
      order.status === "CANCELLED");

  const addItem = trpc.order.addItem.useMutation({
    onSuccess: async () => {
      await refetch();
      await utils.order.listByTenant.invalidate();
      onChanged?.();
      setShowAddPanel(false);
      setSelectedProductId(null);
      setSelectedVariantId(null);
      setAddQuantity(1);
      setAddNotes("");
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  const removeItem = trpc.order.removeItem.useMutation({
    onSuccess: async () => {
      await refetch();
      await utils.order.listByTenant.invalidate();
      onChanged?.();
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  const updateQty = trpc.order.updateItemQuantity.useMutation({
    onSuccess: async () => {
      await refetch();
      await utils.order.listByTenant.invalidate();
      onChanged?.();
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  // Calcula as mudanças entre o snapshot inicial e o estado atual
  const changes: PendingChange[] = useMemo(() => {
    if (!order || !snapshotsReady) return [];
    const result: PendingChange[] = [];

    const currentMap = new Map(
      order.items.map((it) => [
        it.id,
        snapshotFromItem({
          ...it,
          customizations: it.customizations ?? [],
          ingredientModifications: it.ingredientModifications ?? [],
        }),
      ])
    );
    const baseMap = new Map(baseSnapshots.map((s) => [s.id, s]));

    // Removidos: estavam no base e não estão mais no current
    for (const base of baseSnapshots) {
      if (!currentMap.has(base.id)) {
        result.push({ type: "REMOVED", item: base });
      }
    }

    // Adicionados/Modificados
    for (const [id, curr] of currentMap.entries()) {
      const base = baseMap.get(id);
      if (!base) {
        result.push({ type: "ADDED", item: curr });
      } else if (base.quantity !== curr.quantity) {
        result.push({
          type: "QUANTITY_CHANGED",
          item: curr,
          oldQuantity: base.quantity,
        });
      }
    }

    return result;
  }, [order, baseSnapshots, snapshotsReady]);

  const hasPendingChanges = changes.length > 0;

  const products: ProductLite[] = useMemo(() => {
    if (!productsQuery.data) return [];
    return productsQuery.data.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      imageUrl: p.imageUrl,
      hasVariants: p.hasVariants,
      variants: (p.variants ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        price: v.price,
        isActive: v.isActive,
      })),
    }));
  }, [productsQuery.data]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => p.name.toLowerCase().includes(term));
  }, [products, searchTerm]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  function handleAddItem() {
    if (!selectedProduct) return;
    setError(null);

    // Validar variante se necessário
    if (selectedProduct.hasVariants && !selectedVariantId) {
      setError("Selecione um tamanho/variante.");
      return;
    }

    addItem.mutate({
      orderId,
      item: {
        productId: selectedProduct.id,
        productVariantId: selectedVariantId,
        quantity: addQuantity,
        notes: addNotes.trim() || undefined,
        customizations: [],
        ingredients: [],
        paidWithPoints: false,
      },
    });
  }

  function handleRemoveItem(itemId: string) {
    if (!confirm("Remover este item do pedido?")) return;
    removeItem.mutate({ orderId, itemId });
  }

  function handleQtyChange(itemId: string, currentQty: number, delta: number) {
    const newQty = currentQty + delta;
    if (newQty < 1) return;
    updateQty.mutate({ orderId, itemId, quantity: newQty });
  }

  function handleReprint() {
    if (!order) return;
    if (changes.length === 0) {
      alert("Não há mudanças para reimprimir.");
      return;
    }
    const paperWidth =
      printerSettings.printers.find((p) => p.isDefault && p.isActive)
        ?.paperWidth ??
      printerSettings.printers.find((p) => p.isActive)?.paperWidth ??
      "80mm";

    printChangesViaIframe({
      order: {
        id: order.id,
        displayNumber: order.displayNumber ?? String(order.orderNumber),
        type: order.type,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        tableNumber: order.tableNumber ?? null,
      },
      changes,
      paperWidth,
      restaurantName: tenant?.name ?? restaurantName,
    });

    // Após imprimir, redefine o snapshot para o estado atual.
    // Próximas mudanças serão destacadas como novas.
    if (order) {
      const newSnaps = order.items.map((it) =>
        snapshotFromItem({
          ...it,
          customizations: it.customizations ?? [],
          ingredientModifications: it.ingredientModifications ?? [],
        })
      );
      setBaseSnapshots(newSnaps);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-xl font-bold">
              {order
                ? `Pedido ${order.displayNumber ?? order.orderNumber}`
                : "Carregando…"}
            </h2>
            {order && (
              <p className="text-xs text-muted-foreground">
                {typeLabel(order.type)} · {statusLabel(order.status)} ·{" "}
                {paymentLabel(order.paymentMethod)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading || !order ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Aviso de pedido bloqueado */}
              {isLocked && (
                <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    Este pedido está {statusLabel(order.status).toLowerCase()} e
                    não pode mais ser editado.
                  </span>
                </div>
              )}

              {/* Cliente */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Cliente
                </h3>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="font-semibold">{order.customerName}</p>
                  {order.customerPhone && (
                    <p className="text-muted-foreground">{order.customerPhone}</p>
                  )}
                  {order.type === "TABLE" && order.tableNumber && (
                    <p className="mt-1 text-muted-foreground">
                      Mesa {order.tableNumber}
                    </p>
                  )}
                </div>
              </section>

              {/* Endereço (delivery) */}
              {order.type === "DELIVERY" && order.deliveryAddress && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Endereço
                  </h3>
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <p>
                      {(order.deliveryAddress as { street?: string }).street},{" "}
                      {(order.deliveryAddress as { number?: string }).number}
                      {(order.deliveryAddress as { complement?: string })
                        .complement
                        ? ` - ${(order.deliveryAddress as { complement?: string }).complement}`
                        : ""}
                    </p>
                    <p className="text-muted-foreground">
                      {(order.deliveryAddress as { neighborhood?: string }).neighborhood}
                      {" — "}
                      {(order.deliveryAddress as { city?: string }).city}/
                      {(order.deliveryAddress as { state?: string }).state}
                    </p>
                  </div>
                </section>
              )}

              {/* Itens */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                    Itens
                  </h3>
                  {!isLocked && (
                    <button
                      onClick={() => setShowAddPanel(!showAddPanel)}
                      className="flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar produto
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {order.items.map((item) => {
                    const isNew = !baseSnapshots.find((s) => s.id === item.id);
                    const baseSnap = baseSnapshots.find((s) => s.id === item.id);
                    const isModified =
                      baseSnap && baseSnap.quantity !== item.quantity;
                    return (
                      <div
                        key={item.id}
                        className={`rounded-lg border p-3 text-sm ${
                          isNew
                            ? "border-green-300 bg-green-50"
                            : isModified
                              ? "border-blue-300 bg-blue-50"
                              : "border-border bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">
                                {item.productName}
                                {item.variantName && ` (${item.variantName})`}
                              </p>
                              {isNew && (
                                <span className="rounded bg-green-200 px-1.5 py-0.5 text-[10px] font-bold text-green-900">
                                  NOVO
                                </span>
                              )}
                              {isModified && (
                                <span className="rounded bg-blue-200 px-1.5 py-0.5 text-[10px] font-bold text-blue-900">
                                  ALTERADO
                                </span>
                              )}
                            </div>
                            {item.customizations && item.customizations.length > 0 && (
                              <ul className="mt-1 text-xs text-muted-foreground">
                                {item.customizations.map((c) => (
                                  <li key={c.id}>+ {c.customizationOptionName}</li>
                                ))}
                              </ul>
                            )}
                            {item.ingredientModifications &&
                              item.ingredientModifications.length > 0 && (
                                <ul className="mt-1 text-xs text-muted-foreground">
                                  {item.ingredientModifications.map((m) => (
                                    <li key={m.id}>{m.modification}</li>
                                  ))}
                                </ul>
                              )}
                            {item.notes && (
                              <p className="mt-1 text-xs italic text-muted-foreground">
                                Obs: {item.notes}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">
                              {formatCurrency(parseFloat(item.totalPrice))}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(parseFloat(item.unitPrice))} cada
                            </p>
                          </div>
                        </div>

                        {!isLocked && (
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  handleQtyChange(item.id, item.quantity, -1)
                                }
                                disabled={
                                  item.quantity <= 1 ||
                                  updateQty.isPending ||
                                  item.paidWithPoints
                                }
                                className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-40"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="min-w-[2ch] text-center text-sm font-semibold">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  handleQtyChange(item.id, item.quantity, 1)
                                }
                                disabled={
                                  updateQty.isPending || item.paidWithPoints
                                }
                                className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-40"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              disabled={
                                removeItem.isPending || item.paidWithPoints
                              }
                              className="flex items-center gap-1 rounded text-xs text-red-600 hover:underline disabled:opacity-40"
                            >
                              <Trash2 className="h-3 w-3" />
                              Remover
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Painel adicionar produto */}
                {showAddPanel && !isLocked && (
                  <div className="mt-3 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Buscar produto…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 rounded border bg-card px-2 py-1 text-sm"
                      />
                    </div>

                    {!productsQuery.data ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        Carregando produtos…
                      </p>
                    ) : filteredProducts.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        Nenhum produto encontrado.
                      </p>
                    ) : (
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {filteredProducts.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setSelectedProductId(p.id);
                              setSelectedVariantId(null);
                            }}
                            className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${
                              selectedProductId === p.id
                                ? "bg-primary/20 font-semibold"
                                : ""
                            }`}
                          >
                            <span className="flex items-center justify-between">
                              <span>{p.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatCurrency(parseFloat(p.price))}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedProduct && (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        {selectedProduct.hasVariants &&
                          selectedProduct.variants.length > 0 && (
                            <div>
                              <label className="text-xs font-semibold">
                                Tamanho/Variante:
                              </label>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {selectedProduct.variants
                                  .filter((v) => v.isActive)
                                  .map((v) => (
                                    <button
                                      key={v.id}
                                      onClick={() => setSelectedVariantId(v.id)}
                                      className={`rounded border px-2 py-1 text-xs ${
                                        selectedVariantId === v.id
                                          ? "border-primary bg-primary/20"
                                          : ""
                                      }`}
                                    >
                                      {v.name} ({formatCurrency(parseFloat(v.price))})
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}

                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold">Qtd:</label>
                          <button
                            onClick={() => setAddQuantity(Math.max(1, addQuantity - 1))}
                            className="rounded border px-2 py-1 text-xs"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-[2ch] text-center text-sm font-semibold">
                            {addQuantity}
                          </span>
                          <button
                            onClick={() => setAddQuantity(addQuantity + 1)}
                            className="rounded border px-2 py-1 text-xs"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <div>
                          <label className="text-xs font-semibold">
                            Observação (opcional):
                          </label>
                          <input
                            type="text"
                            value={addNotes}
                            onChange={(e) => setAddNotes(e.target.value)}
                            placeholder="Ex: sem cebola"
                            className="mt-1 w-full rounded border bg-card px-2 py-1 text-sm"
                          />
                        </div>

                        <button
                          onClick={handleAddItem}
                          disabled={addItem.isPending}
                          className="w-full rounded bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                        >
                          {addItem.isPending ? (
                            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                          ) : (
                            "Adicionar ao pedido"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Totais */}
              <section className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatCurrency(parseFloat(order.subtotal))}</span>
                </div>
                {parseFloat(order.deliveryFee) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxa de entrega:</span>
                    <span>{formatCurrency(parseFloat(order.deliveryFee))}</span>
                  </div>
                )}
                {parseFloat(order.discount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Desconto:</span>
                    <span>-{formatCurrency(parseFloat(order.discount))}</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between border-t pt-1 text-base font-bold">
                  <span>Total:</span>
                  <span className="text-primary">
                    {formatCurrency(parseFloat(order.total))}
                  </span>
                </div>
              </section>

              {/* Observações do pedido */}
              {order.notes && (
                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Observações
                  </h3>
                  <p className="rounded-lg border bg-muted/30 p-3 text-sm italic">
                    {order.notes}
                  </p>
                </section>
              )}

              {/* Erros */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-6 py-4">
          <div className="text-xs text-muted-foreground">
            {hasPendingChanges ? (
              <span className="font-semibold text-amber-700">
                {changes.length} mudança(s) pendente(s) para reimprimir
              </span>
            ) : (
              "Sem mudanças pendentes"
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Fechar
            </button>
            <button
              onClick={handleReprint}
              disabled={!hasPendingChanges || !order}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              Reimprimir mudanças
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
