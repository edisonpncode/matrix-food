"use client";

import { useRef, type ChangeEvent, type KeyboardEvent } from "react";
import { ImagePlus, SendHorizontal, X } from "lucide-react";

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  pendingImage: string | null;
  onImageSelect: (dataUrl: string) => void;
  onClearImage: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function ChatInput({
  input,
  onInputChange,
  onSend,
  isLoading,
  pendingImage,
  onImageSelect,
  onClearImage,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert("Imagem muito grande. O limite é 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onImageSelect(reader.result);
      }
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((input.trim() || pendingImage) && !isLoading) {
        onSend();
      }
    }
  };

  const canSend = (input.trim() || pendingImage) && !isLoading;

  return (
    <div className="border-t border-border bg-card p-4">
      {/* Image preview */}
      {pendingImage && (
        <div className="mb-3 flex items-start gap-2">
          <div className="relative">
            <img
              src={pendingImage}
              alt="Preview"
              className="h-20 w-20 rounded-lg border border-border object-cover"
            />
            <button
              type="button"
              onClick={onClearImage}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground mt-1">
            Foto do cardápio pronta para enviar
          </span>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* Image upload button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Enviar foto do cardápio"
        >
          <ImagePlus className="h-5 w-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Text input */}
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte algo ou envie uma foto do cardápio..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          style={{ maxHeight: "6rem" }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = Math.min(target.scrollHeight, 96) + "px";
          }}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SendHorizontal className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
