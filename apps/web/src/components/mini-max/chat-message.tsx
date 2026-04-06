"use client";

import { Sparkles, Check, Pencil, X, PackageCheck } from "lucide-react";
import type { UIMessage } from "ai";

interface ChatMessageProps {
  message: UIMessage;
  onAction?: (text: string) => void;
}

interface PreviewCategory {
  name: string;
  description?: string;
  products: {
    name: string;
    description?: string;
    price: string;
    originalPrice?: string;
    isNew?: boolean;
  }[];
}

interface PreviewResult {
  action: "preview";
  categories: PreviewCategory[];
  summary: string;
}

interface ImportResult {
  action: "imported";
  categoriesCreated: number;
  productsCreated: number;
}

export function ChatMessage({ message, onAction }: ChatMessageProps) {
  const isUser = message.role === "user";

  const textContent = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");

  const fileParts = message.parts.filter(
    (p) => p.type === "file" && p.mediaType?.startsWith("image/")
  );

  const toolParts = message.parts.filter((p) => p.type.startsWith("tool-"));

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-2">
        {fileParts.map((part, i) => (
          <img
            key={i}
            src={part.type === "file" ? part.url : ""}
            alt="Imagem enviada"
            className="max-h-48 rounded-2xl rounded-tr-sm border border-primary/30 object-contain"
          />
        ))}
        {textContent && (
          <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            {textContent}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-600">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <div className="max-w-[85%] space-y-3">
        {/* Tool results */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {toolParts.map((part: any, idx: number) => {
          if (part.state !== "output-available" || !part.output) return null;
          const toolName = String(part.type).replace("tool-", "");

          if (toolName === "previewMenu") {
            return (
              <MenuPreviewCard
                key={idx}
                result={part.output as PreviewResult}
                onAction={onAction}
              />
            );
          }

          if (toolName === "importMenu") {
            return (
              <ImportSuccessCard
                key={idx}
                result={part.output as ImportResult}
              />
            );
          }

          return null;
        })}

        {/* Text content */}
        {textContent && (
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground whitespace-pre-wrap">
            {textContent}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuPreviewCard({
  result,
  onAction,
}: {
  result: PreviewResult;
  onAction?: (text: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5">
        <p className="text-sm font-semibold text-white">
          Prévia do Cardápio — {result.summary}
        </p>
      </div>

      <div className="max-h-80 overflow-y-auto p-3 space-y-3">
        {result.categories.map((cat, i) => (
          <div key={i}>
            <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1.5">
              {cat.name}
            </p>
            <div className="space-y-1">
              {cat.products.map((prod, j) => (
                <div
                  key={j}
                  className="flex items-start justify-between gap-2 rounded-md bg-accent/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {prod.name}
                      {prod.isNew && (
                        <span className="ml-1.5 rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          NOVO
                        </span>
                      )}
                    </p>
                    {prod.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {prod.description}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-foreground">
                      R$ {prod.price}
                    </p>
                    {prod.originalPrice && (
                      <p className="text-xs text-muted-foreground line-through">
                        R$ {prod.originalPrice}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {onAction && (
        <div className="flex gap-2 border-t border-border p-3">
          <button
            onClick={() => onAction("Confirma! Pode cadastrar.")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            <Check className="h-4 w-4" />
            Confirmar Cadastro
          </button>
          <button
            onClick={() => onAction("Quero editar alguns itens antes de cadastrar.")}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
          <button
            onClick={() => onAction("Cancela, não quero cadastrar agora.")}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function ImportSuccessCard({ result }: { result: ImportResult }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
      <PackageCheck className="h-5 w-5 shrink-0 text-green-600" />
      <p className="text-sm font-medium text-green-700">
        Cadastrado! {result.categoriesCreated} categoria(s) e{" "}
        {result.productsCreated} produto(s) criados.
      </p>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-600">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
      </div>
    </div>
  );
}
