import { streamText, convertToModelMessages } from "ai";
import { minimax } from "vercel-minimax-ai-provider";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.MINIMAX_API_KEY) {
    return new Response(
      JSON.stringify({ error: "MINIMAX_API_KEY não configurada no servidor." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { messages } = await req.json();

    // MiniMax M2.7 não suporta imagens via este provider.
    // Substitui partes de imagem por uma descrição em texto para que
    // o modelo saiba que o usuário enviou uma imagem.
    const sanitized = messages.map((msg: Record<string, unknown>) => {
      if (!Array.isArray(msg.parts)) return msg;

      const hasFile = msg.parts.some(
        (p: Record<string, unknown>) => p.type === "file"
      );
      if (!hasFile) return msg;

      const textParts = msg.parts.filter(
        (p: Record<string, unknown>) => p.type === "text"
      );
      const fileCount = msg.parts.filter(
        (p: Record<string, unknown>) => p.type === "file"
      ).length;

      return {
        ...msg,
        parts: [
          {
            type: "text",
            text: `[O usuário enviou ${fileCount} imagem(ns). Como o modelo atual não suporta análise de imagens, descreva que não é possível analisar a imagem diretamente, mas peça para o usuário descrever o que aparece na tela ou o erro que está vendo, para que você possa ajudar.]${
              textParts.length > 0
                ? "\n\nMensagem do usuário: " +
                  textParts
                    .map((p: Record<string, unknown>) => p.text)
                    .join(" ")
                : ""
            }`,
          },
        ],
      };
    });

    const result = streamText({
      model: minimax("MiniMax-M2.7"),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(sanitized),
    });

    return result.toUIMessageStreamResponse();
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Mini Max API Error]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
