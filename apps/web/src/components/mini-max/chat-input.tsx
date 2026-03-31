"use client";

import { type KeyboardEvent, type ClipboardEvent, useRef, useState } from "react";
import { SendHorizontal, ImagePlus, X } from "lucide-react";

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: (file?: File) => void;
  isLoading: boolean;
}

export function ChatInput({
  input,
  onInputChange,
  onSend,
  isLoading,
}: ChatInputProps) {
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((input.trim() || pendingImage) && !isLoading) {
        handleSend();
      }
    }
  };

  const handleSend = () => {
    onSend(pendingImage ?? undefined);
    setPendingImage(null);
    setImagePreview(null);
  };

  const loadImage = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert("Imagem muito grande. O limite é 10MB.");
      return;
    }

    setPendingImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadImage(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) loadImage(file);
        return;
      }
    }
  };

  const removeImage = () => {
    setPendingImage(null);
    setImagePreview(null);
  };

  const canSend = (input.trim() || pendingImage) && !isLoading;

  return (
    <div className="border-t border-border bg-card p-4">
      {/* Image preview */}
      {imagePreview && (
        <div className="mb-3 inline-flex items-start gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-20 w-20 rounded-lg border border-border object-cover"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Image upload button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          title="Enviar imagem"
        >
          <ImagePlus className="h-5 w-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Text input */}
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={pendingImage ? "Descreva o erro na imagem..." : "Pergunte algo ou cole um print (Ctrl+V)..."}
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
          onClick={handleSend}
          disabled={!canSend}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendHorizontal className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
