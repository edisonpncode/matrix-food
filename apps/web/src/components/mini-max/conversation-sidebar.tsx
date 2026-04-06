"use client";

import { Plus, MessageSquare, Trash2, Sparkles } from "lucide-react";

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: Date;
}

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isLoading,
}: ConversationSidebarProps) {
  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Conversas</span>
        </div>
        <button
          onClick={onNew}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
          title="Nova conversa"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Nenhuma conversa ainda
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`group flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors ${
                  activeId === conv.id
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-accent border border-transparent"
                }`}
              >
                <MessageSquare
                  className={`h-4 w-4 shrink-0 ${
                    activeId === conv.id
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm ${
                      activeId === conv.id
                        ? "font-semibold text-primary"
                        : "font-medium text-foreground"
                    }`}
                  >
                    {conv.title || "Nova conversa"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {timeAgo(conv.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                  title="Excluir conversa"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
