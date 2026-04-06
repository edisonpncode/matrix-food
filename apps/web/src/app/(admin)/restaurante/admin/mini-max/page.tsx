"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import {
  Sparkles,
  MessageCircle,
  HelpCircle,
  ShoppingBag,
  Users,
  Camera,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { ChatMessage, TypingIndicator } from "@/components/mini-max/chat-message";
import { ChatInput } from "@/components/mini-max/chat-input";
import { ConversationSidebar } from "@/components/mini-max/conversation-sidebar";
import { trpc } from "@/lib/trpc";

export default function NeoAssistentePage() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: tenant } = trpc.tenant.getById.useQuery();

  // Conversas para a sidebar
  const {
    data: conversations,
    isLoading: conversationsLoading,
  } = trpc.aiChat.list.useQuery(undefined, { enabled: !!tenant });

  // Mensagens da conversa ativa
  const { data: conversationData } = trpc.aiChat.getById.useQuery(
    { id: activeConversationId! },
    { enabled: !!activeConversationId }
  );

  // Mutations
  const utils = trpc.useUtils();
  const createConversation = trpc.aiChat.create.useMutation({
    onSuccess: () => utils.aiChat.list.invalidate(),
  });
  const addMessage = trpc.aiChat.addMessage.useMutation();
  const generateTitle = trpc.aiChat.generateTitle.useMutation({
    onSuccess: () => utils.aiChat.list.invalidate(),
  });
  const deleteConversation = trpc.aiChat.delete.useMutation({
    onSuccess: () => utils.aiChat.list.invalidate(),
  });

  return (
    <div className="flex h-[calc(100vh-1.5rem)]">
      {/* Sidebar de conversas */}
      {sidebarOpen && (
        <div className="w-72 shrink-0">
          <ConversationSidebar
            conversations={conversations ?? []}
            activeId={activeConversationId}
            onSelect={setActiveConversationId}
            onNew={() => setActiveConversationId(null)}
            onDelete={(id) => {
              deleteConversation.mutate({ id });
              if (activeConversationId === id) setActiveConversationId(null);
            }}
            isLoading={conversationsLoading}
          />
        </div>
      )}

      {/* Painel do chat */}
      <div className="flex flex-1 flex-col">
        <ChatPanel
          key={activeConversationId ?? "new"}
          conversationId={activeConversationId}
          initialMessages={conversationData?.messages}
          tenantId={tenant?.id}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onConversationCreated={(id) => setActiveConversationId(id)}
          createConversation={createConversation}
          addMessage={addMessage}
          generateTitle={generateTitle}
          invalidateList={() => utils.aiChat.list.invalidate()}
        />
      </div>
    </div>
  );
}

// ============================================
// Chat Panel (remontado ao trocar de conversa via key)
// ============================================

interface ChatPanelProps {
  conversationId: string | null;
  initialMessages?: { id: string; role: string; parts: unknown[] }[];
  tenantId?: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onConversationCreated: (id: string) => void;
  createConversation: { mutateAsync: () => Promise<{ id: string }> };
  addMessage: {
    mutateAsync: (data: {
      conversationId: string;
      id: string;
      role: "user" | "assistant";
      parts: unknown[];
    }) => Promise<unknown>;
  };
  generateTitle: {
    mutate: (data: { conversationId: string; firstMessage: string }) => void;
  };
  invalidateList: () => void;
}

function ChatPanel({
  conversationId,
  initialMessages,
  tenantId,
  sidebarOpen,
  onToggleSidebar,
  onConversationCreated,
  createConversation,
  addMessage,
  generateTitle,
  invalidateList,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const convIdRef = useRef<string | null>(conversationId);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: { tenantId },
      }),
    [tenantId]
  );

  // Converter mensagens do banco para formato UIMessage
  const dbMessages = useMemo<UIMessage[] | undefined>(() => {
    if (!initialMessages) return undefined;
    return initialMessages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: m.parts as UIMessage["parts"],
    }));
  }, [initialMessages]);

  const { messages, sendMessage, setMessages, status, error } = useChat({
    id: conversationId ?? undefined,
    transport,
    onFinish: async ({ message }) => {
      // Salvar mensagem do assistente no banco
      const cid = convIdRef.current;
      if (cid && message.role === "assistant") {
        try {
          await addMessage.mutateAsync({
            conversationId: cid,
            id: message.id,
            role: "assistant",
            parts: message.parts as unknown[],
          });
          invalidateList();
        } catch {
          // silenciar erro de save
        }
      }
    },
  });

  // Carregar mensagens históricas ao montar com uma conversa existente
  useEffect(() => {
    if (dbMessages && dbMessages.length > 0 && messages.length === 0) {
      setMessages(dbMessages);
    }
  }, [dbMessages, messages.length, setMessages]);

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = useCallback(
    async (file?: File) => {
      const text = inputText.trim();
      if (!text && !file) return;

      let cid = convIdRef.current;
      const isFirstMessage = !cid;

      // Criar conversa se necessário
      if (!cid) {
        try {
          const result = await createConversation.mutateAsync();
          cid = result.id;
          convIdRef.current = cid;
          onConversationCreated(cid);
        } catch {
          return;
        }
      }

      // Preparar arquivo se houver
      let files:
        | { type: "file"; mediaType: string; url: string }[]
        | undefined;
      if (file) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        files = [
          { type: "file" as const, mediaType: file.type, url: dataUrl },
        ];
      }

      const msgText =
        text || "Analise esta imagem e me ajude a resolver o problema.";

      // Salvar mensagem do usuário no banco
      const userMsgId = crypto.randomUUID();
      const userParts: unknown[] = [];
      if (files) {
        for (const f of files) userParts.push(f);
      }
      if (msgText) userParts.push({ type: "text", text: msgText });

      addMessage
        .mutateAsync({
          conversationId: cid,
          id: userMsgId,
          role: "user",
          parts: userParts,
        })
        .catch(() => {});

      // Enviar para a IA
      sendMessage({
        text: msgText,
        ...(files ? { files } : {}),
      });

      setInputText("");

      // Gerar título na primeira mensagem
      if (isFirstMessage && text) {
        generateTitle.mutate({
          conversationId: cid,
          firstMessage: text,
        });
      }
    },
    [
      inputText,
      createConversation,
      addMessage,
      sendMessage,
      generateTitle,
      onConversationCreated,
    ]
  );

  const suggestions = [
    {
      icon: Camera,
      text: "Cadastrar cardápio por foto",
      query: "Quero cadastrar um cardápio. Vou enviar uma imagem agora.",
    },
    {
      icon: HelpCircle,
      text: "Como cadastrar produtos?",
      query: "Como faço para cadastrar um novo produto no sistema?",
    },
    {
      icon: ShoppingBag,
      text: "Como gerenciar pedidos?",
      query: "Como funciona o gerenciamento de pedidos no sistema?",
    },
    {
      icon: Users,
      text: "Como cadastrar funcionários?",
      query:
        "Como cadastro funcionários e defino permissões no sistema?",
    },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          onClick={onToggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={sidebarOpen ? "Fechar painel" : "Abrir conversas"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-600">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Neo Assistente</h1>
          <p className="text-[11px] text-muted-foreground">
            Assistente inteligente do Matrix Food
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <WelcomeState
            suggestions={suggestions}
            onSuggestionClick={(query) => {
              setInputText(query);
              // Não enviar direto — deixar no input para o usuário confirmar
            }}
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((message, idx) => (
              <div key={message.id}>
                <ChatMessage
                  message={message}
                  onAction={
                    idx === messages.length - 1 && !isLoading
                      ? (text) => {
                          setInputText(text);
                          // Simular envio automatico ao clicar botão
                          const cid = convIdRef.current;
                          if (cid) {
                            const msgId = crypto.randomUUID();
                            addMessage
                              .mutateAsync({
                                conversationId: cid,
                                id: msgId,
                                role: "user",
                                parts: [{ type: "text", text }],
                              })
                              .catch(() => {});
                          }
                          sendMessage({ text });
                        }
                      : undefined
                  }
                />
              </div>
            ))}
            {isLoading && <TypingIndicator />}
            {error && (
              <div className="ml-11 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <p className="font-medium">Erro ao comunicar com a IA</p>
                <p className="mt-1 text-xs opacity-75">
                  {error.message || "Tente novamente."}
                </p>
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
    </>
  );
}

// ============================================
// Welcome State
// ============================================

interface WelcomeStateProps {
  suggestions: {
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    text: string;
    query: string;
  }[];
  onSuggestionClick: (query: string) => void;
}

function WelcomeState({ suggestions, onSuggestionClick }: WelcomeStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-600">
        <Sparkles className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-xl font-bold text-foreground">Olá! Eu sou o Neo</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Assistente inteligente do Matrix Food. Tire dúvidas ou envie uma foto do
        cardápio para cadastrar automaticamente!
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
