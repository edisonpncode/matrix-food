"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sparkles, MessageCircle, HelpCircle, ShoppingBag, Users, Camera } from "lucide-react";
import { ChatMessage, TypingIndicator } from "@/components/mini-max/chat-message";
import { ChatInput } from "@/components/mini-max/chat-input";
import { trpc } from "@/lib/trpc";

export default function MiniMaxPage() {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: tenant } = trpc.tenant.getById.useQuery();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: { tenantId: tenant?.id },
      }),
    [tenant?.id]
  );

  const { messages, sendMessage, status, error } = useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (file?: File) => {
    const text = inputText.trim();
    if (!text && !file) return;

    let files: { type: "file"; mediaType: string; url: string }[] | undefined;
    if (file) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      files = [{ type: "file" as const, mediaType: file.type, url: dataUrl }];
    }

    sendMessage({
      text: text || "Analise esta imagem e me ajude a resolver o problema.",
      ...(files ? { files } : {}),
    });
    setInputText("");
  };

  const suggestions = [
    { icon: Camera, text: "Cadastrar cardápio por foto", query: "Quero cadastrar um cardápio. Vou enviar uma imagem agora." },
    { icon: HelpCircle, text: "Como cadastrar produtos?", query: "Como faço para cadastrar um novo produto no sistema?" },
    { icon: ShoppingBag, text: "Como gerenciar pedidos?", query: "Como funciona o gerenciamento de pedidos no sistema?" },
    { icon: Users, text: "Como cadastrar funcionários?", query: "Como cadastro funcionários e defino permissões no sistema?" },
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
            onSuggestionClick={(query) => sendMessage({ text: query })}
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((message) => (
              <div key={message.id}>
                <ChatMessage message={message} />
              </div>
            ))}
            {isLoading && <TypingIndicator />}
            {error && (
              <div className="ml-11 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <p className="font-medium">Erro ao comunicar com a IA</p>
                <p className="mt-1 text-xs opacity-75">{error.message || "Tente novamente."}</p>
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
          onSend={(file) => handleSend(file)}
          isLoading={isLoading}
        />
      </div>
    </div>
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
      <h2 className="text-xl font-bold text-foreground">Olá! Eu sou o Mini Max</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Seu assistente inteligente do Matrix Food. Posso tirar dúvidas sobre
        qualquer funcionalidade do sistema!
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
