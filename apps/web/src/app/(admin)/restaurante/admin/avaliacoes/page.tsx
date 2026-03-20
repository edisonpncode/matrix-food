"use client";

import { useState } from "react";
import { Star, MessageSquare, Send } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function AvaliacoesPage() {
  const utils = trpc.useUtils();
  const { data: reviews, isLoading } = trpc.review.listByTenant.useQuery({
    limit: 50,
  });

  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const replyMutation = trpc.review.reply.useMutation({
    onSuccess: () => {
      utils.review.listByTenant.invalidate();
      setReplyingId(null);
      setReplyText("");
    },
  });

  function handleReply(reviewId: string) {
    if (!replyText.trim()) return;
    replyMutation.mutate({ reviewId, reply: replyText.trim() });
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Avaliações</h1>
        <p className="mt-1 text-muted-foreground">
          {reviews?.length ?? 0} avaliações dos seus clientes
        </p>
      </div>

      {!reviews || reviews.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Star className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="mb-2 text-lg font-semibold">Nenhuma avaliação</h2>
          <p className="text-sm text-muted-foreground">
            Avaliações aparecerão aqui quando clientes avaliarem seus pedidos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-xl border bg-card p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {review.customerName ?? "Cliente"}
                    </span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {review.comment}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(review.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {!review.reply && (
                  <button
                    onClick={() => {
                      setReplyingId(
                        replyingId === review.id ? null : review.id
                      );
                      setReplyText("");
                    }}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Responder"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Reply */}
              {review.reply && (
                <div className="mt-3 rounded-lg bg-primary/5 p-3">
                  <p className="text-xs font-medium text-primary">
                    Sua resposta
                  </p>
                  <p className="mt-1 text-sm">{review.reply}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {review.repliedAt &&
                      new Date(review.repliedAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              )}

              {/* Reply form */}
              {replyingId === review.id && !review.reply && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Escreva sua resposta..."
                    className="flex-1 rounded-lg border px-3 py-2 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && replyText.trim()) {
                        handleReply(review.id);
                      }
                    }}
                  />
                  <button
                    onClick={() => handleReply(review.id)}
                    disabled={!replyText.trim() || replyMutation.isPending}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" />
                    Enviar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
