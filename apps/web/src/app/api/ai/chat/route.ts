import { streamText, convertToModelMessages, tool, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { getDb, categories, products } from "@matrix-food/database";

export const maxDuration = 60;

/**
 * Google Gemini não aceita data: URLs — converte para Uint8Array.
 */
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
        return {
          ...part,
          image: new Uint8Array(Buffer.from(base64, "base64")),
        };
      }
    }

    if (part.type === "file" && typeof part.data === "string") {
      const d = part.data as string;
      if (d.startsWith("data:")) {
        const base64 = d.slice(d.indexOf(",") + 1);
        return {
          ...part,
          data: new Uint8Array(Buffer.from(base64, "base64")),
        };
      }
    }

    return part;
  });
}

/**
 * Cria a tool de importação de cardápio com o tenantId do restaurante.
 */
function createImportMenuTool(tenantId: string) {
  return tool({
    description:
      "Cadastra categorias e produtos no sistema Matrix Food a partir de dados extraídos de uma imagem de cardápio. Use sempre que o usuário enviar uma foto/print de cardápio e pedir para cadastrar.",
    inputSchema: z.object({
      categories: z.array(
        z.object({
          name: z.string().describe("Nome da categoria, ex: 'Hambúrguer', 'Bebidas'"),
          description: z.string().optional().describe("Descrição da categoria"),
          products: z.array(
            z.object({
              name: z.string().describe("Nome do produto"),
              description: z
                .string()
                .optional()
                .describe("Descrição ou ingredientes do produto"),
              price: z
                .string()
                .describe("Preço atual em formato decimal, ex: '29.90'"),
              originalPrice: z
                .string()
                .optional()
                .describe(
                  "Preço original riscado (indica promoção), ex: '38.00'"
                ),
              isNew: z
                .boolean()
                .optional()
                .describe("Se o produto tem tag de 'novo' ou '{novo}'"),
            })
          ),
        })
      ),
    }),
    execute: async ({ categories: cats }) => {
      const db = getDb();
      let categoriesCreated = 0;
      let productsCreated = 0;
      const details: string[] = [];

      for (let i = 0; i < cats.length; i++) {
        const cat = cats[i]!;

        const [createdCategory] = await db
          .insert(categories)
          .values({
            tenantId,
            name: cat.name,
            description: cat.description,
            sortOrder: i,
            isActive: true,
          })
          .returning();

        if (!createdCategory) continue;
        categoriesCreated++;

        for (let j = 0; j < cat.products.length; j++) {
          const prod = cat.products[j]!;

          await db.insert(products).values({
            tenantId,
            categoryId: createdCategory.id,
            name: prod.name,
            description: prod.description,
            price: prod.price,
            originalPrice: prod.originalPrice,
            isNew: prod.isNew ?? false,
            sortOrder: j,
            isActive: true,
          });

          productsCreated++;
          details.push(
            `  • ${prod.name} — R$ ${prod.price}${prod.originalPrice ? ` (antes R$ ${prod.originalPrice})` : ""}${prod.isNew ? " [NOVO]" : ""}`
          );
        }
      }

      return {
        success: true,
        categoriesCreated,
        productsCreated,
        details,
        message: `Cadastrado com sucesso: ${categoriesCreated} categoria(s) e ${productsCreated} produto(s).`,
      };
    },
  });
}

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "GOOGLE_GENERATIVE_AI_API_KEY não configurada no servidor.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { messages, tenantId } = await req.json();

    const modelMessages = await convertToModelMessages(messages);

    // Converte data: URLs para Uint8Array (Gemini exige http/https ou inline)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fixed = modelMessages.map((msg: any) => ({
      ...msg,
      content: fixDataUrls(msg.content),
    }));

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: SYSTEM_PROMPT,
      messages: fixed,
      tools: tenantId
        ? { importMenu: createImportMenuTool(tenantId) }
        : undefined,
      stopWhen: stepCountIs(3),
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
