"use client";

import { useState, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Download, Share2 } from "lucide-react";

interface ShareLinkSectionProps {
  slug: string;
}

export function ShareLinkSection({ slug }: ShareLinkSectionProps) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "https://matrixfood.com.br";

  const menuUrl = `${baseUrl}/restaurantes/${slug}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = menuUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [menuUrl]);

  const handleDownloadQR = useCallback(() => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    canvas.width = 512;
    canvas.height = 512;

    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 512, 512);
        ctx.drawImage(img, 0, 0, 512, 512);

        const link = document.createElement("a");
        link.download = `qrcode-${slug}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      }
    };

    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  }, [slug]);

  const handleShareWhatsApp = useCallback(() => {
    const text = encodeURIComponent(
      `Faca seu pedido online: ${menuUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }, [menuUrl]);

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        Link do Cardapio
      </h2>

      <p className="mb-4 text-sm text-muted-foreground">
        Compartilhe este link com seus clientes para que possam fazer pedidos
        online.
      </p>

      {/* URL + Copiar */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-input bg-background p-2">
        <input
          type="text"
          value={menuUrl}
          readOnly
          className="flex-1 bg-transparent text-sm text-foreground outline-none"
        />
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copiar
            </>
          )}
        </button>
      </div>

      {/* QR Code */}
      <div className="mb-4 flex flex-col items-center rounded-lg border border-border bg-white p-6">
        <div ref={qrRef}>
          <QRCodeSVG
            value={menuUrl}
            size={200}
            level="H"
            includeMargin
            fgColor="#1a1a2e"
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Escaneie para abrir o cardapio
        </p>
      </div>

      {/* Botoes de acao */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleDownloadQR}
          className="flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Download className="h-4 w-4" />
          Baixar QR Code
        </button>
        <button
          onClick={handleShareWhatsApp}
          className="flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
        >
          <Share2 className="h-4 w-4" />
          WhatsApp
        </button>
      </div>
    </section>
  );
}
