"use client";

import { useState } from "react";
import { Star, Send, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ReviewFormProps {
  orderId: string;
  tenantId: string;
}

export function ReviewForm({ orderId, tenantId }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const createReview = trpc.review.create.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  if (submitted) {
    return (
      <div className="flex flex-col items-center rounded-xl bg-white p-6 text-center shadow-sm">
        <Check className="h-10 w-10 text-green-500" />
        <p className="mt-2 font-semibold text-green-700">
          Obrigado pela sua avaliação!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-3 font-semibold">Avalie seu pedido</h3>

      {/* Stars */}
      <div className="mb-4 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`h-9 w-9 ${
                star <= (hoveredRating || rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>

      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Conte como foi sua experiência (opcional)"
            rows={2}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={() =>
              createReview.mutate({
                orderId,
                tenantId,
                rating,
                comment: comment || undefined,
              })
            }
            disabled={createReview.isPending}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {createReview.isPending ? "Enviando..." : "Enviar avaliação"}
          </button>
        </>
      )}
    </div>
  );
}
