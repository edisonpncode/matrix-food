import type { PaperWidth } from "./receipt-types";
import {
  getTypeLabel,
  separator,
  formatCurrencyPlain,
  PAYMENT_LABELS,
} from "./receipt-types";
import type {
  PendingChange,
  OrderItemSnapshot,
  PrintChangesOrder,
} from "@/lib/print-changes";

interface ChangesReceiptProps {
  order: PrintChangesOrder;
  changes: PendingChange[];
  paperWidth: PaperWidth;
  restaurantName: string;
}

function formatNow(): string {
  return new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ItemBadge = "ADDED" | "QUANTITY_CHANGED" | "UNCHANGED";

function classifyItem(
  itemId: string,
  changes: PendingChange[]
): { badge: ItemBadge; oldQuantity?: number } {
  for (const c of changes) {
    if (c.type === "ADDED" && c.item.id === itemId) {
      return { badge: "ADDED" };
    }
    if (c.type === "QUANTITY_CHANGED" && c.item.id === itemId) {
      return { badge: "QUANTITY_CHANGED", oldQuantity: c.oldQuantity };
    }
  }
  return { badge: "UNCHANGED" };
}

function ItemRow({
  item,
  badge,
  oldQuantity,
}: {
  item: OrderItemSnapshot;
  badge: ItemBadge;
  oldQuantity?: number;
}) {
  const containerStyle: React.CSSProperties = {
    marginBottom: "3mm",
    padding: badge === "UNCHANGED" ? "0" : "2mm",
    border:
      badge === "ADDED"
        ? "3px double #000"
        : badge === "QUANTITY_CHANGED"
          ? "2px dashed #000"
          : "none",
  };

  return (
    <div style={containerStyle}>
      {badge === "ADDED" && (
        <div
          style={{
            fontSize: "13px",
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: "1mm",
          }}
        >
          ** ITEM NOVO **
        </div>
      )}
      {badge === "QUANTITY_CHANGED" && (
        <div
          style={{
            fontSize: "13px",
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: "1mm",
          }}
        >
          ** ITEM ALTERADO **
        </div>
      )}

      <div
        style={{
          fontSize: badge === "UNCHANGED" ? "13px" : "14px",
          fontWeight: "bold",
        }}
      >
        {item.quantity}x {item.productName}
        {item.variantName ? ` (${item.variantName})` : ""}
      </div>

      {badge === "QUANTITY_CHANGED" && oldQuantity !== undefined && (
        <div
          style={{
            fontSize: "12px",
            fontWeight: "bold",
            paddingLeft: "8px",
          }}
        >
          (antes:{" "}
          <span style={{ textDecoration: "line-through" }}>{oldQuantity}</span>{" "}
          → agora: {item.quantity})
        </div>
      )}

      {item.customizations.length > 0 && (
        <div style={{ paddingLeft: "8px", fontSize: "11px" }}>
          {item.customizations.map((c, i) => (
            <div key={i}>+ {c.name}</div>
          ))}
        </div>
      )}
      {item.ingredientModifications.length > 0 && (
        <div style={{ paddingLeft: "8px", fontSize: "11px" }}>
          {item.ingredientModifications.map((m, i) => (
            <div key={i}>{m.modification}</div>
          ))}
        </div>
      )}
      {item.notes && (
        <div
          style={{
            paddingLeft: "8px",
            fontSize: "11px",
            fontWeight: "bold",
            fontStyle: "italic",
          }}
        >
          OBS: {item.notes}
        </div>
      )}
    </div>
  );
}

function RemovedItemBlock({ item }: { item: OrderItemSnapshot }) {
  return (
    <div
      style={{
        marginBottom: "3mm",
        padding: "2mm",
        border: "2px solid #000",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: "1mm",
        }}
      >
        ** ITEM REMOVIDO **
      </div>
      <div
        style={{
          fontSize: "14px",
          fontWeight: "bold",
          textDecoration: "line-through",
        }}
      >
        {item.quantity}x {item.productName}
        {item.variantName ? ` (${item.variantName})` : ""}
      </div>
      {item.customizations.length > 0 && (
        <div
          style={{
            paddingLeft: "8px",
            fontSize: "11px",
            textDecoration: "line-through",
          }}
        >
          {item.customizations.map((c, i) => (
            <div key={i}>+ {c.name}</div>
          ))}
        </div>
      )}
      {item.notes && (
        <div
          style={{
            paddingLeft: "8px",
            fontSize: "11px",
            fontStyle: "italic",
            textDecoration: "line-through",
          }}
        >
          OBS: {item.notes}
        </div>
      )}
      <div
        style={{
          fontSize: "11px",
          fontWeight: "bold",
          marginTop: "1mm",
          textAlign: "center",
        }}
      >
        NAO PREPARAR ESTE ITEM
      </div>
    </div>
  );
}

export function ChangesReceipt({
  order,
  changes,
  paperWidth,
  restaurantName,
}: ChangesReceiptProps) {
  const typeLabel = getTypeLabel(order.type, order.tableNumber);
  const sep = separator(paperWidth);

  const removedItems = changes
    .filter((c): c is { type: "REMOVED"; item: OrderItemSnapshot } =>
      c.type === "REMOVED"
    )
    .map((c) => c.item);

  const addedCount = changes.filter((c) => c.type === "ADDED").length;
  const modifiedCount = changes.filter(
    (c) => c.type === "QUANTITY_CHANGED"
  ).length;
  const removedCount = removedItems.length;

  const deliveryFee = parseFloat(order.deliveryFee);
  const discount = parseFloat(order.discount);

  return (
    <div
      style={{
        fontFamily: "'Courier New', 'Lucida Console', monospace",
        fontSize: "12px",
        lineHeight: "1.4",
        width: paperWidth === "80mm" ? "80mm" : "58mm",
        maxWidth: paperWidth === "80mm" ? "80mm" : "58mm",
        padding: "4mm",
        color: "#000",
        backgroundColor: "#fff",
      }}
    >
      {/* Banner de alerta — bem chamativo */}
      <div
        style={{
          textAlign: "center",
          border: "3px solid #000",
          padding: "2mm",
          marginBottom: "2mm",
        }}
      >
        <div style={{ fontSize: "18px", fontWeight: "bold" }}>
          *** ATENCAO ***
        </div>
        <div style={{ fontSize: "16px", fontWeight: "bold" }}>
          PEDIDO ALTERADO
        </div>
        <div style={{ fontSize: "10px", marginTop: "1mm" }}>
          DESCARTAR COMANDA ANTERIOR
        </div>
        <div style={{ fontSize: "10px", fontWeight: "bold" }}>
          USAR ESTA COMO COMANDA ATUAL
        </div>
      </div>

      {/* Restaurante */}
      <div style={{ textAlign: "center", marginBottom: "2mm" }}>
        <div
          style={{
            fontSize: "14px",
            fontWeight: "bold",
            textTransform: "uppercase",
          }}
        >
          {restaurantName}
        </div>
      </div>

      <div style={{ fontSize: "10px" }}>{sep}</div>

      {/* Identificação do pedido */}
      <div style={{ textAlign: "center", margin: "2mm 0" }}>
        <div style={{ fontSize: "20px", fontWeight: "bold" }}>
          PEDIDO #{order.displayNumber}
        </div>
        <div
          style={{
            display: "inline-block",
            border: "1px solid #000",
            padding: "1px 6px",
            fontSize: "10px",
            fontWeight: "bold",
          }}
        >
          {typeLabel}
        </div>
      </div>

      <div style={{ fontSize: "10px" }}>{sep}</div>

      {/* Cliente */}
      <div style={{ margin: "2mm 0" }}>
        <div>
          <span style={{ fontWeight: "bold" }}>Cliente: </span>
          {order.customerName}
        </div>
        {order.customerPhone && (
          <div>
            <span style={{ fontWeight: "bold" }}>Fone: </span>
            {order.customerPhone}
          </div>
        )}
      </div>

      {/* Endereço (delivery) */}
      {order.type === "DELIVERY" && order.deliveryAddress && (
        <div style={{ margin: "2mm 0" }}>
          <div style={{ fontWeight: "bold" }}>Endereco:</div>
          <div>
            {order.deliveryAddress.street}, {order.deliveryAddress.number}
            {order.deliveryAddress.complement
              ? ` - ${order.deliveryAddress.complement}`
              : ""}
          </div>
          {order.deliveryAddress.neighborhood && (
            <div>{order.deliveryAddress.neighborhood}</div>
          )}
          {(order.deliveryAddress.city || order.deliveryAddress.state) && (
            <div>
              {order.deliveryAddress.city}
              {order.deliveryAddress.state
                ? ` - ${order.deliveryAddress.state}`
                : ""}
            </div>
          )}
          {order.deliveryAddress.referencePoint && (
            <div style={{ fontStyle: "italic" }}>
              Ref: {order.deliveryAddress.referencePoint}
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: "10px" }}>{sep}</div>

      {/* Resumo das mudanças */}
      <div style={{ textAlign: "center", margin: "2mm 0" }}>
        <div style={{ fontSize: "12px", fontWeight: "bold" }}>
          ALTERACOES NESTA REIMPRESSAO
        </div>
        <div style={{ fontSize: "10px" }}>
          {addedCount > 0 && `${addedCount} adicionado(s)  `}
          {modifiedCount > 0 && `${modifiedCount} alterado(s)  `}
          {removedCount > 0 && `${removedCount} removido(s)`}
        </div>
      </div>

      <div style={{ fontSize: "10px" }}>{sep}</div>

      {/* PEDIDO COMPLETO ATUALIZADO */}
      <div style={{ textAlign: "center", margin: "2mm 0" }}>
        <div style={{ fontSize: "13px", fontWeight: "bold" }}>
          PEDIDO COMPLETO
        </div>
      </div>

      {/* Itens removidos primeiro (aviso de não preparar) */}
      {removedItems.length > 0 && (
        <div style={{ margin: "2mm 0" }}>
          {removedItems.map((item, i) => (
            <RemovedItemBlock key={`rem-${i}`} item={item} />
          ))}
        </div>
      )}

      {/* Todos os itens atuais (com badge se mudaram) */}
      <div style={{ margin: "2mm 0" }}>
        {order.items.map((item) => {
          const { badge, oldQuantity } = classifyItem(item.id, changes);
          return (
            <ItemRow
              key={item.id}
              item={item}
              badge={badge}
              oldQuantity={oldQuantity}
            />
          );
        })}
      </div>

      <div style={{ fontSize: "10px" }}>{sep}</div>

      {/* Totais atualizados */}
      <div style={{ margin: "2mm 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal:</span>
          <span>{formatCurrencyPlain(order.subtotal)}</span>
        </div>
        {deliveryFee > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Taxa Entrega:</span>
            <span>{formatCurrencyPlain(order.deliveryFee)}</span>
          </div>
        )}
        {discount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Desconto:</span>
            <span>-{formatCurrencyPlain(order.discount)}</span>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: "bold",
            fontSize: "14px",
            marginTop: "2px",
          }}
        >
          <span>TOTAL:</span>
          <span>{formatCurrencyPlain(order.total)}</span>
        </div>
      </div>

      <div style={{ fontSize: "10px" }}>{sep}</div>

      {/* Pagamento */}
      <div>
        <span style={{ fontWeight: "bold" }}>Pagamento: </span>
        {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
      </div>

      {/* Observações */}
      {order.notes && (
        <div style={{ marginTop: "2mm" }}>
          <span style={{ fontWeight: "bold" }}>Obs: </span>
          <span style={{ fontStyle: "italic" }}>{order.notes}</span>
        </div>
      )}

      <div style={{ fontSize: "10px", marginTop: "2mm" }}>{sep}</div>

      {/* Aviso final */}
      <div
        style={{
          textAlign: "center",
          fontSize: "12px",
          fontWeight: "bold",
          margin: "2mm 0",
          padding: "2mm",
          border: "1px solid #000",
        }}
      >
        SUBSTITUI A COMANDA ANTERIOR
      </div>

      <div style={{ textAlign: "center", fontSize: "10px", marginTop: "2mm" }}>
        Reimpressao: {formatNow()}
      </div>
    </div>
  );
}
