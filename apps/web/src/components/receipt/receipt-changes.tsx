import type { PaperWidth } from "./receipt-types";
import { getTypeLabel, separator } from "./receipt-types";
import type {
  PendingChange,
  OrderItemSnapshot,
} from "@/lib/print-changes";

interface ChangesReceiptProps {
  order: {
    id: string;
    displayNumber: string;
    type: string;
    customerName: string;
    customerPhone: string;
    tableNumber: number | null;
  };
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

function ItemBlock({
  item,
  prefix,
  highlight,
}: {
  item: OrderItemSnapshot;
  prefix: string;
  highlight: "added" | "removed" | "modified";
}) {
  const border =
    highlight === "added"
      ? "3px double #000"
      : highlight === "removed"
        ? "2px solid #000"
        : "2px dashed #000";

  return (
    <div
      style={{
        marginBottom: "3mm",
        padding: "2mm",
        border,
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: "bold",
          textTransform: "uppercase",
          textAlign: "center",
          marginBottom: "1mm",
          textDecoration: highlight === "removed" ? "line-through" : undefined,
        }}
      >
        ** {prefix} **
      </div>
      <div
        style={{
          fontSize: "14px",
          fontWeight: "bold",
          textDecoration: highlight === "removed" ? "line-through" : undefined,
        }}
      >
        {item.quantity}x {item.productName}
        {item.variantName ? ` (${item.variantName})` : ""}
      </div>
      {item.customizations.length > 0 && (
        <div style={{ paddingLeft: "8px", fontSize: "12px" }}>
          {item.customizations.map((c, i) => (
            <div key={i}>+ {c.name}</div>
          ))}
        </div>
      )}
      {item.ingredientModifications.length > 0 && (
        <div style={{ paddingLeft: "8px", fontSize: "12px" }}>
          {item.ingredientModifications.map((m, i) => (
            <div key={i}>{m.modification}</div>
          ))}
        </div>
      )}
      {item.notes && (
        <div
          style={{
            paddingLeft: "8px",
            fontSize: "12px",
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

export function ChangesReceipt({
  order,
  changes,
  paperWidth,
  restaurantName,
}: ChangesReceiptProps) {
  const typeLabel = getTypeLabel(order.type, order.tableNumber);
  const sep = separator(paperWidth);

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
        <div style={{ fontSize: "11px", marginTop: "1mm" }}>
          {restaurantName.toUpperCase()}
        </div>
      </div>

      {/* Identificação */}
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

      <div style={{ fontSize: "10px" }}>{sep}</div>

      {/* Resumo das mudanças */}
      <div style={{ textAlign: "center", margin: "2mm 0" }}>
        <div style={{ fontSize: "13px", fontWeight: "bold" }}>
          ALTERACOES NO PEDIDO
        </div>
        <div style={{ fontSize: "10px" }}>
          {changes.length} {changes.length === 1 ? "mudanca" : "mudancas"}
        </div>
      </div>

      <div style={{ fontSize: "10px" }}>{sep}</div>

      {/* Mudanças */}
      <div style={{ margin: "2mm 0" }}>
        {/* Adições primeiro */}
        {changes
          .filter((c) => c.type === "ADDED")
          .map((c, i) => (
            <ItemBlock
              key={`added-${i}`}
              item={c.item}
              prefix="ITEM ADICIONADO"
              highlight="added"
            />
          ))}

        {/* Modificações */}
        {changes
          .filter((c) => c.type === "QUANTITY_CHANGED")
          .map((c, i) => {
            if (c.type !== "QUANTITY_CHANGED") return null;
            return (
              <div
                key={`mod-${i}`}
                style={{
                  marginBottom: "3mm",
                  padding: "2mm",
                  border: "2px dashed #000",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    textAlign: "center",
                    marginBottom: "1mm",
                  }}
                >
                  ** ITEM ALTERADO **
                </div>
                <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                  {c.item.productName}
                  {c.item.variantName ? ` (${c.item.variantName})` : ""}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: "bold",
                    marginTop: "1mm",
                  }}
                >
                  Quantidade:{" "}
                  <span style={{ textDecoration: "line-through" }}>
                    {c.oldQuantity}
                  </span>{" "}
                  &rarr; {c.item.quantity}
                </div>
                {c.item.notes && (
                  <div
                    style={{
                      paddingLeft: "8px",
                      fontSize: "12px",
                      fontStyle: "italic",
                    }}
                  >
                    OBS: {c.item.notes}
                  </div>
                )}
              </div>
            );
          })}

        {/* Remoções por último, com aviso */}
        {changes
          .filter((c) => c.type === "REMOVED")
          .map((c, i) => (
            <ItemBlock
              key={`rem-${i}`}
              item={c.item}
              prefix="ITEM REMOVIDO"
              highlight="removed"
            />
          ))}
      </div>

      <div style={{ fontSize: "10px" }}>{sep}</div>

      {/* Aviso final em destaque */}
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
        ATUALIZE A COMANDA NA COZINHA
      </div>

      <div style={{ textAlign: "center", fontSize: "10px", marginTop: "2mm" }}>
        Reimpressao: {formatNow()}
      </div>
    </div>
  );
}
