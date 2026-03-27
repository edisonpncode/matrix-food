"use client";

import { formatCurrency } from "@matrix-food/utils";

interface OrderReceiptProps {
  order: {
    id: string;
    displayNumber: string;
    type: string;
    status: string;
    customerName: string;
    customerPhone: string;
    tableNumber?: number | null;
    deliveryAddress?: {
      street: string;
      number: string;
      complement?: string;
      neighborhood: string;
      city: string;
      state: string;
      referencePoint?: string;
    } | null;
    subtotal: string;
    deliveryFee: string;
    discount: string;
    total: string;
    paymentMethod: string;
    notes?: string | null;
    createdAt: string | Date;
    items: Array<{
      productName: string;
      variantName?: string | null;
      quantity: number;
      unitPrice: string;
      totalPrice: string;
      notes?: string | null;
      customizations?: Array<{
        customizationOptionName: string;
        price: string;
      }>;
    }>;
  };
  deliveryPersonName?: string | null;
  restaurantName?: string;
}

const TYPE_LABELS: Record<string, string> = {
  COUNTER: "BALCAO",
  DINE_IN: "MESA",
  PICKUP: "VEM BUSCAR",
  DELIVERY: "TELE ENTREGA",
};

const PAYMENT_LABELS: Record<string, string> = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartao de Credito",
  DEBIT_CARD: "Cartao de Debito",
};

function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrderReceipt({
  order,
  deliveryPersonName,
  restaurantName,
}: OrderReceiptProps) {
  const subtotal = parseFloat(order.subtotal);
  const deliveryFee = parseFloat(order.deliveryFee);
  const discount = parseFloat(order.discount);
  const total = parseFloat(order.total);

  const typeLabel =
    order.type === "DINE_IN" && order.tableNumber
      ? `MESA ${order.tableNumber}`
      : TYPE_LABELS[order.type] ?? order.type;

  return (
    <div
      id={`receipt-${order.id}`}
      className="mx-auto max-w-[300px] bg-white p-4 font-mono text-xs print:max-w-none print:p-2"
    >
      {/* Restaurant name */}
      {restaurantName && (
        <div className="mb-2 text-center">
          <p className="text-sm font-bold uppercase">{restaurantName}</p>
        </div>
      )}

      {/* Divider */}
      <div className="border-b border-dashed border-gray-400 my-2 print:border-black" />

      {/* Order number */}
      <div className="text-center mb-2">
        <p className="text-lg font-bold">PEDIDO #{order.displayNumber}</p>
        <span className="inline-block rounded border border-gray-800 px-2 py-0.5 text-[10px] font-bold uppercase">
          {typeLabel}
        </span>
      </div>

      {/* Customer info */}
      <div className="mb-1">
        <p>
          <span className="font-bold">Cliente:</span> {order.customerName}
        </p>
        <p>
          <span className="font-bold">Fone:</span> {order.customerPhone}
        </p>
      </div>

      {/* Delivery address */}
      {order.type === "DELIVERY" && order.deliveryAddress && (
        <div className="mb-1">
          <p className="font-bold">Endereco:</p>
          <p>
            {order.deliveryAddress.street}, {order.deliveryAddress.number}
            {order.deliveryAddress.complement
              ? ` - ${order.deliveryAddress.complement}`
              : ""}
          </p>
          <p>{order.deliveryAddress.neighborhood}</p>
          <p>
            {order.deliveryAddress.city} - {order.deliveryAddress.state}
          </p>
          {order.deliveryAddress.referencePoint && (
            <p className="italic">
              Ref: {order.deliveryAddress.referencePoint}
            </p>
          )}
        </div>
      )}

      {/* Delivery person */}
      {deliveryPersonName && (
        <p className="mb-1">
          <span className="font-bold">Entregador:</span> {deliveryPersonName}
        </p>
      )}

      {/* Divider */}
      <div className="border-b border-dashed border-gray-400 my-2 print:border-black" />

      {/* Items */}
      <div className="space-y-1.5">
        {order.items.map((item, idx) => (
          <div key={idx}>
            {/* Item line */}
            <div className="flex justify-between">
              <span>
                {item.quantity}x {item.productName}
                {item.variantName ? ` (${item.variantName})` : ""}
              </span>
              <span className="ml-2 flex-shrink-0 text-right">
                {formatCurrency(parseFloat(item.totalPrice))}
              </span>
            </div>
            {/* Customizations */}
            {item.customizations &&
              item.customizations.length > 0 &&
              item.customizations.map((cust, ci) => (
                <p key={ci} className="pl-3 text-[10px] text-gray-600 print:text-black">
                  + {cust.customizationOptionName}
                  {parseFloat(cust.price) > 0
                    ? ` (${formatCurrency(parseFloat(cust.price))})`
                    : ""}
                </p>
              ))}
            {/* Item notes */}
            {item.notes && (
              <p className="pl-3 text-[10px] italic text-gray-500 print:text-black">
                {item.notes}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-b border-dashed border-gray-400 my-2 print:border-black" />

      {/* Totals */}
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {deliveryFee > 0 && (
          <div className="flex justify-between">
            <span>Taxa Entrega</span>
            <span>{formatCurrency(deliveryFee)}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between">
            <span>Desconto</span>
            <span>-{formatCurrency(discount)}</span>
          </div>
        )}
        <div className="flex justify-between pt-1 text-sm font-bold">
          <span>TOTAL</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Payment method */}
      <div className="mt-2">
        <p>
          <span className="font-bold">Pagamento:</span>{" "}
          {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
        </p>
      </div>

      {/* Order notes */}
      {order.notes && (
        <div className="mt-2">
          <p className="font-bold">Obs:</p>
          <p className="italic">{order.notes}</p>
        </div>
      )}

      {/* Order time */}
      <div className="mt-2 text-center text-[10px] text-gray-500 print:text-black">
        <p>{formatDateTime(order.createdAt)}</p>
      </div>

      {/* Divider */}
      <div className="border-b border-dashed border-gray-400 my-2 print:border-black" />

      {/* Footer */}
      <div className="text-center text-[10px]">
        <p>Obrigado pela preferencia!</p>
      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-${order.id},
          #receipt-${order.id} * {
            visibility: visible;
          }
          #receipt-${order.id} {
            position: absolute;
            left: 0;
            top: 0;
            width: 300px;
            max-width: 300px;
            font-size: 12px;
            padding: 8px;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Opens a new window with the receipt content and triggers the print dialog.
 * @param elementId - The ID of the receipt element to print (e.g., "receipt-{orderId}")
 */
export function printReceipt(elementId: string) {
  const content = document.getElementById(elementId);
  if (!content) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Pedido</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            margin: 0;
            padding: 8px;
            width: 300px;
            color: #000;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .italic { font-style: italic; }
          .uppercase { text-transform: uppercase; }
          .text-sm { font-size: 14px; }
          .text-lg { font-size: 16px; }
          .text-\\[10px\\] { font-size: 10px; }
          .mb-1 { margin-bottom: 4px; }
          .mb-2 { margin-bottom: 8px; }
          .mt-2 { margin-top: 8px; }
          .pl-3 { padding-left: 12px; }
          .ml-2 { margin-left: 8px; }
          .pt-1 { padding-top: 4px; }
          .px-2 { padding-left: 8px; padding-right: 8px; }
          .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
          .p-4 { padding: 16px; }
          .space-y-0\\.5 > * + * { margin-top: 2px; }
          .space-y-1\\.5 > * + * { margin-top: 6px; }
          .divider {
            border-bottom: 1px dashed #000;
            margin: 8px 0;
          }
          .flex {
            display: flex;
          }
          .justify-between {
            justify-content: space-between;
          }
          .flex-shrink-0 {
            flex-shrink: 0;
          }
          .inline-block {
            display: inline-block;
          }
          .rounded {
            border-radius: 4px;
          }
          .border {
            border: 1px solid #000;
          }
        </style>
      </head>
      <body>${content.innerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}
