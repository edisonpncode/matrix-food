import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ChangesReceipt } from "@/components/receipt/receipt-changes";
import type { PaperWidth } from "@/components/receipt/receipt-types";

export interface OrderItemSnapshot {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  notes: string | null;
  customizations: Array<{ name: string; price: string }>;
  ingredientModifications: Array<{ modification: string; price: string }>;
}

export type PendingChange =
  | { type: "ADDED"; item: OrderItemSnapshot }
  | { type: "REMOVED"; item: OrderItemSnapshot }
  | {
      type: "QUANTITY_CHANGED";
      item: OrderItemSnapshot;
      oldQuantity: number;
    };

interface PrintChangesArgs {
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

/**
 * Imprime via iframe oculto um ticket especial de "Reimpressão — Alterações"
 * destacando o que foi adicionado, modificado ou removido no pedido.
 */
export function printChangesViaIframe(args: PrintChangesArgs): void {
  const html = renderToStaticMarkup(
    createElement(ChangesReceipt, {
      order: args.order,
      changes: args.changes,
      paperWidth: args.paperWidth,
      restaurantName: args.restaurantName,
    })
  );

  const widthMm = args.paperWidth === "80mm" ? "80mm" : "58mm";

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reimpressão</title>
  <style>
    @page {
      size: ${widthMm} auto;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Courier New', 'Lucida Console', monospace;
      font-size: 12px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      width: ${widthMm};
      max-width: ${widthMm};
    }
    @media print {
      body {
        width: ${widthMm};
        max-width: ${widthMm};
      }
    }
  </style>
</head>
<body>${html}</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 250);
}
