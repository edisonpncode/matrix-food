import type {
  ReceiptOrder,
  ReceiptConfig,
  PaperWidth,
} from "./receipt-types";
import {
  getTypeLabel,
  separator,
  formatCurrencyPlain,
  formatDateTime,
  PAYMENT_LABELS,
} from "./receipt-types";

interface CustomerReceiptProps {
  order: ReceiptOrder;
  config: ReceiptConfig;
  paperWidth: PaperWidth;
  restaurantName: string;
  deliveryPersonName?: string | null;
}

export function CustomerReceipt({
  order,
  config,
  paperWidth,
  restaurantName,
  deliveryPersonName,
}: CustomerReceiptProps) {
  const typeLabel = getTypeLabel(order.type, order.tableNumber);
  const sep = separator(paperWidth);
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
      {/* Cabecalho - Nome do restaurante */}
      <div style={{ textAlign: "center", marginBottom: "2mm" }}>
        <div style={{ fontSize: "16px", fontWeight: "bold", textTransform: "uppercase" }}>
          {restaurantName}
        </div>
        {config.headerText &&
          config.headerText.split("\n").map((line, i) => (
            <div key={i} style={{ fontSize: "10px" }}>
              {line}
            </div>
          ))}
      </div>

      <div style={{ fontSize: "10px" }}>{sep}</div>

      {/* Numero do pedido */}
      <div style={{ textAlign: "center", margin: "2mm 0" }}>
        <div style={{ fontSize: "18px", fontWeight: "bold" }}>
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

      {/* Dados do cliente */}
      {config.showCustomerInfo && (
        <div style={{ margin: "2mm 0" }}>
          <div>
            <span style={{ fontWeight: "bold" }}>Cliente: </span>
            {order.customerName}
          </div>
          <div>
            <span style={{ fontWeight: "bold" }}>Fone: </span>
            {order.customerPhone}
          </div>
        </div>
      )}

      {/* Endereco de entrega */}
      {config.showDeliveryAddress &&
        order.type === "DELIVERY" &&
        order.deliveryAddress && (
          <div style={{ margin: "2mm 0" }}>
            <div style={{ fontWeight: "bold" }}>Endereco:</div>
            <div>
              {order.deliveryAddress.street}, {order.deliveryAddress.number}
              {order.deliveryAddress.complement
                ? ` - ${order.deliveryAddress.complement}`
                : ""}
            </div>
            <div>{order.deliveryAddress.neighborhood}</div>
            <div>
              {order.deliveryAddress.city} - {order.deliveryAddress.state}
            </div>
            {order.deliveryAddress.referencePoint && (
              <div style={{ fontStyle: "italic" }}>
                Ref: {order.deliveryAddress.referencePoint}
              </div>
            )}
          </div>
        )}

      {/* Entregador */}
      {deliveryPersonName && (
        <div>
          <span style={{ fontWeight: "bold" }}>Entregador: </span>
          {deliveryPersonName}
        </div>
      )}

      <div style={{ fontSize: "10px" }}>{sep}</div>

      {/* Itens */}
      <div style={{ margin: "2mm 0" }}>
        {order.items.map((item, idx) => (
          <div key={idx} style={{ marginBottom: "2px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>
                {item.quantity}x {item.productName}
                {item.variantName ? ` (${item.variantName})` : ""}
              </span>
              <span style={{ flexShrink: 0, marginLeft: "4px" }}>
                {formatCurrencyPlain(item.totalPrice)}
              </span>
            </div>
            {item.customizations?.map((cust, ci) => (
              <div key={ci} style={{ paddingLeft: "12px", fontSize: "10px" }}>
                + {cust.customizationOptionName}
                {parseFloat(cust.price) > 0
                  ? ` (${formatCurrencyPlain(cust.price)})`
                  : ""}
              </div>
            ))}
            {config.showItemNotes && item.notes && (
              <div
                style={{
                  paddingLeft: "12px",
                  fontSize: "10px",
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

      {/* Totais */}
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
      {config.showPaymentMethod && (
        <div>
          <span style={{ fontWeight: "bold" }}>Pagamento: </span>
          {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
        </div>
      )}

      {/* Observacoes */}
      {config.showOrderNotes && order.notes && (
        <div style={{ marginTop: "2mm" }}>
          <span style={{ fontWeight: "bold" }}>Obs: </span>
          <span style={{ fontStyle: "italic" }}>{order.notes}</span>
        </div>
      )}

      {/* Timestamp */}
      {config.showTimestamp && (
        <div
          style={{
            textAlign: "center",
            fontSize: "10px",
            marginTop: "2mm",
          }}
        >
          {formatDateTime(order.createdAt)}
        </div>
      )}

      <div style={{ fontSize: "10px" }}>{sep}</div>

      {/* Rodape */}
      <div style={{ textAlign: "center", fontSize: "10px", marginTop: "2mm" }}>
        {config.footerText
          ? config.footerText.split("\n").map((line, i) => (
              <div key={i}>{line}</div>
            ))
          : "Obrigado pela preferencia!"}
      </div>
    </div>
  );
}
