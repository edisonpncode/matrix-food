"use client";

import { Sparkles } from "lucide-react";
import type { UIMessage } from "ai";

interface ChatMessageProps {
  message: UIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  const textContent = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");

  const fileParts = message.parts.filter(
    (p) => p.type === "file" && p.mediaType?.startsWith("image/")
  );

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
      <div className="max-w-[75%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-sm text-foreground whitespace-pre-wrap">
        {textContent}
      </div>
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
