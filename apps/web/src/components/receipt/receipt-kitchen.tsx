import type { ReceiptOrder, PaperWidth } from "./receipt-types";
import { getTypeLabel, separator, formatDateTime } from "./receipt-types";

interface KitchenReceiptProps {
  order: ReceiptOrder;
  paperWidth: PaperWidth;
}

export function KitchenReceipt({ order, paperWidth }: KitchenReceiptProps) {
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
      {/* Titulo */}
      <div style={{ textAlign: "center", marginBottom: "2mm" }}>
        <div style={{ fontSize: "16px", fontWeight: "bold" }}>
          *** COZINHA ***
        </div>
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

      {/* Itens - sem precos, letra grande */}
      <div style={{ margin: "2mm 0" }}>
        {order.items.map((item, idx) => (
          <div key={idx} style={{ marginBottom: "4px" }}>
            <div style={{ fontSize: "14px", fontWeight: "bold" }}>
              {item.quantity}x {item.productName}
              {item.variantName ? ` (${item.variantName})` : ""}
            </div>
            {item.customizations?.map((cust, ci) => (
              <div
                key={ci}
                style={{ paddingLeft: "12px", fontSize: "12px" }}
              >
                + {cust.customizationOptionName}
              </div>
            ))}
            {item.notes && (
              <div
                style={{
                  paddingLeft: "12px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  fontStyle: "italic",
                }}
              >
                OBS: {item.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ fontSize: "10px" }}>{sep}</div>

      {/* Observacoes do pedido em destaque */}
      {order.notes && (
        <div
          style={{
            textAlign: "center",
            fontSize: "14px",
            fontWeight: "bold",
            margin: "2mm 0",
          }}
        >
          ** {order.notes.toUpperCase()} **
        </div>
      )}

      {/* Timestamp */}
      <div style={{ textAlign: "center", fontSize: "10px", marginTop: "2mm" }}>
        {formatDateTime(order.createdAt)}
      </div>
    </div>
  );
}
