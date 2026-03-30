"use client";

import { Sparkles } from "lucide-react";
import type { Message } from "ai";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Extract text and images from message content
  const textContent =
    typeof message.content === "string"
      ? message.content
      : "";

  const images: string[] = [];
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (typeof part === "object" && "type" in part) {
        if (part.type === "image" && "image" in part) {
          images.push(part.image as string);
        }
      }
    }
  }

  if (!textContent && images.length === 0) return null;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-600">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
      )}

      <div
        className={`max-w-[80%] space-y-2 ${isUser ? "items-end" : "items-start"}`}
      >
        {/* Images */}
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt="Imagem enviada"
            className="max-h-48 rounded-lg object-cover"
          />
        ))}

        {/* Text */}
        {textContent && (
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              isUser
                ? "rounded-br-sm bg-primary text-primary-foreground"
                : "rounded-bl-sm border border-border bg-card text-foreground"
            }`}
          >
            {textContent.split("\n").map((line, i) => (
              <p key={i} className={i > 0 ? "mt-2" : ""}>
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-600">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
