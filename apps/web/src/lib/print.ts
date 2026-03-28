import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { CustomerReceipt } from "@/components/receipt/receipt-customer";
import { KitchenReceipt } from "@/components/receipt/receipt-kitchen";
import { DeliveryReceipt } from "@/components/receipt/receipt-delivery";
import type {
  ReceiptOrder,
  ReceiptConfig,
  PaperWidth,
  ReceiptType,
} from "@/components/receipt/receipt-types";

/**
 * Imprime um recibo via iframe oculto no navegador.
 * Funciona com impressoras USB que aparecem como impressoras do Windows.
 */
export function printViaIframe(
  order: ReceiptOrder,
  config: ReceiptConfig,
  paperWidth: PaperWidth,
  receiptType: ReceiptType,
  restaurantName: string,
  deliveryPersonName?: string | null
): void {
  let html: string;

  if (receiptType === "CUSTOMER") {
    html = renderToStaticMarkup(
      createElement(CustomerReceipt, {
        order,
        config,
        paperWidth,
        restaurantName,
        deliveryPersonName,
      })
    );
  } else if (receiptType === "KITCHEN") {
    html = renderToStaticMarkup(
      createElement(KitchenReceipt, {
        order,
        paperWidth,
      })
    );
  } else {
    html = renderToStaticMarkup(
      createElement(DeliveryReceipt, {
        order,
        paperWidth,
        deliveryPersonName,
      })
    );
  }

  const widthMm = paperWidth === "80mm" ? "80mm" : "58mm";

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recibo</title>
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

  // Usar iframe oculto para evitar bloqueio de pop-ups
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

  // Aguardar renderizacao e imprimir
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    // Remover iframe apos impressao
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 250);
}

/**
 * Imprime uma pagina de teste via navegador.
 */
export function printTestPage(
  restaurantName: string,
  paperWidth: PaperWidth
): void {
  const widthMm = paperWidth === "80mm" ? "80mm" : "58mm";
  const sep = paperWidth === "80mm" ? "-".repeat(48) : "-".repeat(32);
  const now = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Teste</title>
  <style>
    @page { size: ${widthMm} auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', 'Lucida Console', monospace;
      font-size: 12px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      width: ${widthMm};
      padding: 4mm;
      text-align: center;
    }
    .name { font-size: 16px; font-weight: bold; text-transform: uppercase; }
    .sep { font-size: 10px; margin: 2mm 0; }
  </style>
</head>
<body>
  <div class="name">${restaurantName}</div>
  <div class="sep">${sep}</div>
  <div>TESTE DE IMPRESSAO</div>
  <div>Impressora configurada com sucesso!</div>
  <br>
  <div>Papel: ${paperWidth}</div>
  <div>${now}</div>
  <div class="sep">${sep}</div>
  <div>Matrix Food</div>
</body>
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
