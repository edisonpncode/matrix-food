import { streamText, convertToModelMessages, tool, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { getDb, categories, products } from "@matrix-food/database";

export const maxDuration = 60;

// Schema compartilhado entre previewMenu e importMenu
const menuCategorySchema = z.object({
  name: z.string().describe("Nome da categoria, ex: 'Hambúrguer', 'Bebidas'"),
  description: z.string().optional().describe("Descrição da categoria"),
  products: z.array(
    z.object({
      name: z.string().describe("Nome do produto"),
      description: z.string().optional().describe("Descrição ou ingredientes"),
      price: z.string().describe("Preço em decimal, ex: '29.90'"),
      originalPrice: z.string().optional().describe("Preço riscado (promoção)"),
      isNew: z.boolean().optional().describe("Tag 'novo'"),
    })
  ),
});

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

function createTools(tenantId: string) {
  return {
    /**
     * Busca conteúdo de uma URL (cardápio online, etc.)
     */
    fetchUrl: tool({
      description:
        "Busca o conteúdo de texto de uma URL. Use quando o usuário enviar um link de cardápio.",
      inputSchema: z.object({
        url: z.string().url().describe("URL para buscar"),
      }),
      execute: async ({ url }) => {
        const res = await fetch(url, {
          headers: { "User-Agent": "MatrixFood-Neo/1.0" },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return { error: `Erro ${res.status} ao acessar a URL.` };
        const html = await res.text();
        // Strip HTML tags, keep text
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 15000); // limit to 15k chars
        return { content: text };
      },
    }),

    /**
     * Prévia do cardápio — NÃO salva no banco.
     * O frontend renderiza como card com botões de confirmar/editar.
     */
    previewMenu: tool({
      description:
        "Mostra uma prévia do cardápio extraído para o usuário confirmar antes de cadastrar. SEMPRE use esta tool ANTES de importMenu. NUNCA pule a prévia.",
      inputSchema: z.object({
        categories: z.array(menuCategorySchema),
      }),
      execute: async ({ categories: cats }) => {
        const totalProducts = cats.reduce((sum, c) => sum + c.products.length, 0);
        return {
          action: "preview",
          categories: cats,
          summary: `${cats.length} categoria(s), ${totalProducts} produto(s)`,
        };
      },
    }),

    /**
     * Cadastro efetivo — salva no banco de dados.
     */
    importMenu: tool({
      description:
        "Cadastra categorias e produtos no banco de dados. Use SOMENTE após o usuário confirmar a prévia do previewMenu.",
      inputSchema: z.object({
        categories: z.array(menuCategorySchema),
      }),
      execute: async ({ categories: cats }) => {
        const db = getDb();
        let categoriesCreated = 0;
        let productsCreated = 0;

        for (let i = 0; i < cats.length; i++) {
          const cat = cats[i]!;
          const [created] = await db
            .insert(categories)
            .values({
              tenantId,
              name: cat.name,
              description: cat.description,
              sortOrder: i,
              isActive: true,
            })
            .returning();

          if (!created) continue;
          categoriesCreated++;

          for (let j = 0; j < cat.products.length; j++) {
            const prod = cat.products[j]!;
            await db.insert(products).values({
              tenantId,
              categoryId: created.id,
              name: prod.name,
              description: prod.description,
              price: prod.price,
              originalPrice: prod.originalPrice,
              isNew: prod.isNew ?? false,
              sortOrder: j,
              isActive: true,
            });
            productsCreated++;
          }
        }

        return {
          action: "imported",
          categoriesCreated,
          productsCreated,
        };
      },
    }),
  };
}

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "GOOGLE_GENERATIVE_AI_API_KEY não configurada." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { messages, tenantId } = await req.json();
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
      tools: tenantId ? createTools(tenantId) : undefined,
      stopWhen: stepCountIs(5),
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
