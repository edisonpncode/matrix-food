import { streamText, tool, convertToModelMessages, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { extractedMenuSchema } from "@/lib/ai/tools";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY não configurada" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      extractMenuFromImage: tool({
        description:
          "Extrai categorias e produtos de uma foto de cardápio de restaurante. Use esta tool sempre que o usuário enviar uma imagem de cardápio.",
        inputSchema: extractedMenuSchema,
      }),
    },
    stopWhen: stepCountIs(2),
  });

  return result.toUIMessageStreamResponse();
}
