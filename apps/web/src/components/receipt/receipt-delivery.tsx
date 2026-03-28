import type { ReceiptOrder, PaperWidth } from "./receipt-types";
import {
  separator,
  formatCurrencyPlain,
  PAYMENT_LABELS,
} from "./receipt-types";

interface DeliveryReceiptProps {
  order: ReceiptOrder;
  paperWidth: PaperWidth;
  deliveryPersonName?: string | null;
}

export function DeliveryReceipt({
  order,
  paperWidth,
  deliveryPersonName,
}: DeliveryReceiptProps) {
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
      {/* Numero do pedido */}
      <div
        style={{
          textAlign: "center",
          fontSize: "20px",
          fontWeight: "bold",
          marginBottom: "2mm",
        }}
      >
        PEDIDO #{order.displayNumber}
      </div>

      <div style={{ fontSize: "10px" }}>{sep}</div>

      {/* Cliente - destaque */}
      <div style={{ margin: "2mm 0" }}>
        <div style={{ fontSize: "16px", fontWeight: "bold" }}>
          {order.customerName.toUpperCase()}
        </div>
        <div>{order.customerPhone}</div>
      </div>

      {/* Endereco - destaque */}
      {order.deliveryAddress && (
        <div style={{ margin: "2mm 0" }}>
          <div style={{ fontSize: "14px", fontWeight: "bold" }}>
            {order.deliveryAddress.street}, {order.deliveryAddress.number}
            {order.deliveryAddress.complement
              ? ` - ${order.deliveryAddress.complement}`
              : ""}
          </div>
          <div style={{ fontSize: "14px", fontWeight: "bold" }}>
            {order.deliveryAddress.neighborhood}
          </div>
          {order.deliveryAddress.referencePoint && (
            <div style={{ fontWeight: "bold", fontStyle: "italic" }}>
              Ref: {order.deliveryAddress.referencePoint}
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: "10px" }}>{sep}</div>

      {/* Itens compactos */}
      <div style={{ margin: "2mm 0" }}>
        {order.items.map((item, idx) => (
          <div key={idx}>
            {item.quantity}x {item.productName}
            {item.variantName ? ` (${item.variantName})` : ""}
          </div>
        ))}
      </div>

      {/* Total */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "16px",
          fontWeight: "bold",
          margin: "2mm 0",
        }}
      >
        <span>TOTAL:</span>
        <span>{formatCurrencyPlain(order.total)}</span>
      </div>

      {/* Pagamento */}
      <div>
        Pagamento: {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
      </div>

      {/* Troco */}
      {order.paymentMethod === "CASH" && order.changeFor && (
        <div>Troco para: {formatCurrencyPlain(order.changeFor)}</div>
      )}

      {/* Entregador */}
      {deliveryPersonName && (
        <div style={{ fontWeight: "bold", marginTop: "2mm" }}>
          Entregador: {deliveryPersonName}
        </div>
      )}
    </div>
  );
}
