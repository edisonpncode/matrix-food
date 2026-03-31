"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sparkles, MessageCircle, Camera, HelpCircle } from "lucide-react";
import { ChatMessage, TypingIndicator } from "@/components/mini-max/chat-message";
import { ChatInput } from "@/components/mini-max/chat-input";
import { MenuPreviewCard } from "@/components/mini-max/menu-preview-card";
import type { ExtractedMenu } from "@/lib/ai/tools";
import { trpc } from "@/lib/trpc";

export default function MiniMaxPage() {
  const [extractedMenu, setExtractedMenu] = useState<ExtractedMenu | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
    }),
    onToolCall({ toolCall }) {
      if (toolCall.toolName === "extractMenuFromImage") {
        setExtractedMenu(toolCall.input as ExtractedMenu);
      }
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  const importMutation = trpc.minimax.importMenu.useMutation({
    onSuccess: (result) => {
      setExtractedMenu(null);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          parts: [
            {
              type: "text" as const,
              text: `Pronto! Importei ${result.categoriesCreated} categorias e ${result.productsCreated} produtos com sucesso! Você pode vê-los nas páginas de Categorias e Produtos.`,
            },
          ],
        },
      ]);
      utils.category.listAll.invalidate();
      utils.product.listAll.invalidate();
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, extractedMenu, isLoading]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text && !pendingImage) return;

    if (pendingImage) {
      sendMessage({
        text: text || "Extraia o cardápio desta imagem",
        files: [
          {
            type: "file" as const,
            mediaType: pendingImage.startsWith("data:image/png") ? "image/png" : "image/jpeg",
            url: pendingImage,
          },
        ],
      });
      setPendingImage(null);
    } else {
      sendMessage({ text });
    }
    setInputText("");
  };

  const handleImport = () => {
    if (!extractedMenu) return;
    importMutation.mutate({
      categories: extractedMenu.categories.map((cat) => ({
        name: cat.name,
        description: cat.description,
        products: cat.products.map((p) => ({
          name: p.name,
          description: p.description,
          price: p.price,
        })),
      })),
    });
  };

  const suggestions = [
    { icon: HelpCircle, text: "Como cadastrar produtos?", query: "Como faço para cadastrar um novo produto no sistema?" },
    { icon: StarIcon, text: "Como funciona o fidelidade?", query: "Como funciona o programa de fidelidade para clientes?" },
    { icon: Camera, text: "Extrair cardápio de foto", query: "Quero extrair o cardápio de uma foto. Como funciona?" },
  ];

  return (
    <div className="flex h-[calc(100vh-1.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-600">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Mini Max</h1>
          <p className="text-xs text-muted-foreground">
            Seu assistente inteligente do Matrix Food
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <WelcomeState
            suggestions={suggestions}
            onSuggestionClick={(query) => {
              sendMessage({ text: query });
            }}
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((message, index) => (
              <div key={message.id}>
                <ChatMessage message={message} />
                {extractedMenu &&
                  message.role === "assistant" &&
                  index === messages.length - 1 && (
                    <MenuPreviewCard
                      menu={extractedMenu}
                      onConfirm={handleImport}
                      onCancel={() => setExtractedMenu(null)}
                      isImporting={importMutation.isPending}
                    />
                  )}
              </div>
            ))}
            {isLoading && !extractedMenu && <TypingIndicator />}
            {error && (
              <div className="ml-11 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                Erro ao comunicar com a IA. Tente novamente.
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mx-auto w-full max-w-3xl">
        <ChatInput
          input={inputText}
          onInputChange={setInputText}
          onSend={handleSend}
          isLoading={isLoading}
          pendingImage={pendingImage}
          onImageSelect={setPendingImage}
          onClearImage={() => setPendingImage(null)}
        />
      </div>
    </div>
  );
}

// ---------- Internal components ----------

function StarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

interface WelcomeStateProps {
  suggestions: { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; text: string; query: string }[];
  onSuggestionClick: (query: string) => void;
}

function WelcomeState({ suggestions, onSuggestionClick }: WelcomeStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-600">
        <Sparkles className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-xl font-bold text-foreground">
        Olá! Eu sou o Mini Max
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Seu assistente inteligente do Matrix Food. Posso tirar dúvidas sobre o
        sistema e até cadastrar seu cardápio a partir de uma foto!
      </p>

      <div className="mt-8 grid w-full gap-3">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSuggestionClick(s.query)}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left text-sm text-foreground transition-colors hover:border-primary/50 hover:bg-accent"
          >
            <s.icon className="h-5 w-5 shrink-0 text-primary" />
            <span>{s.text}</span>
            <MessageCircle className="ml-auto h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
