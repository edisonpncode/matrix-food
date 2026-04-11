import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { createTools } from "@/lib/ai/tools";

export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fixDataUrls(content: any): any {
  if (!Array.isArray(content)) return content;
  return content.map((part: Record<string, unknown>) => {
    if (part.type === "image") {
      const raw = part.image;
      const dataUrl =
        typeof raw === "string" && (raw as string).startsWith("data:")
          ? (raw as string)
          : raw instanceof URL && raw.protocol === "data:"
            ? raw.toString()
            : null;
      if (dataUrl) {
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        return { ...part, image: new Uint8Array(Buffer.from(base64, "base64")) };
      }
    }
    if (part.type === "file" && typeof part.data === "string") {
      const d = part.data as string;
      if (d.startsWith("data:")) {
        const base64 = d.slice(d.indexOf(",") + 1);
        return { ...part, data: new Uint8Array(Buffer.from(base64, "base64")) };
      }
    }
    return part;
  });
}

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "GOOGLE_GENERATIVE_AI_API_KEY não configurada." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const messages = body.messages;
    const tenantId = body.tenantId || process.env.DEV_TENANT_ID || null;
    const modelMessages = await convertToModelMessages(messages);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fixed = modelMessages.map((msg: any) => ({
      ...msg,
      content: fixDataUrls(msg.content),
    }));

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: SYSTEM_PROMPT,
      messages: fixed,
      tools: createTools(tenantId),
      stopWhen: stepCountIs(8),
    });

    return result.toUIMessageStreamResponse();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Neo Assistente API Error]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
