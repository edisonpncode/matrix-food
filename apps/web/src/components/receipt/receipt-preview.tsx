"use client";

import { CustomerReceipt } from "./receipt-customer";
import type { ReceiptConfig, PaperWidth, ReceiptOrder } from "./receipt-types";

const SAMPLE_ORDER: ReceiptOrder = {
  id: "preview",
  displayNumber: "0042",
  type: "DELIVERY",
  status: "CONFIRMED",
  customerName: "Joao da Silva",
  customerPhone: "(51) 99999-9999",
  deliveryAddress: {
    street: "Rua Exemplo",
    number: "456",
    complement: "Apto 301",
    neighborhood: "Centro",
    city: "Porto Alegre",
    state: "RS",
    referencePoint: "Proximo ao mercado",
  },
  subtotal: "74.80",
  deliveryFee: "8.00",
  discount: "5.00",
  total: "77.80",
  paymentMethod: "PIX",
  notes: "Sem cebola",
  createdAt: new Date().toISOString(),
  items: [
    {
      productName: "Hamburguer Artesanal",
      quantity: 2,
      unitPrice: "29.90",
      totalPrice: "59.80",
      customizations: [
        { customizationOptionName: "Bacon Extra", price: "5.00" },
        { customizationOptionName: "Queijo Cheddar", price: "3.00" },
      ],
    },
    {
      productName: "Coca-Cola 350ml",
      quantity: 1,
      unitPrice: "7.00",
      totalPrice: "7.00",
      notes: "Bem gelada",
    },
  ],
};

interface ReceiptPreviewProps {
  config: ReceiptConfig;
  paperWidth: PaperWidth;
  restaurantName: string;
}

export function ReceiptPreview({
  config,
  paperWidth,
  restaurantName,
}: ReceiptPreviewProps) {
  return (
    <div
      style={{
        background: "#f9f9f9",
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "16px",
        display: "flex",
        justifyContent: "center",
        overflow: "auto",
      }}
    >
      <div
        style={{
          background: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          borderRadius: "4px",
          transform: "scale(0.85)",
          transformOrigin: "top center",
        }}
      >
        <CustomerReceipt
          order={SAMPLE_ORDER}
          config={config}
          paperWidth={paperWidth}
          restaurantName={restaurantName || "Meu Restaurante"}
        />
      </div>
    </div>
  );
}
