import { z } from "zod";

export const extractedMenuSchema = z.object({
  categories: z.array(
    z.object({
      name: z.string().describe("Nome da categoria (ex: Lanches, Bebidas, Pizzas)"),
      description: z.string().optional().describe("Descrição da categoria"),
      products: z.array(
        z.object({
          name: z.string().describe("Nome do produto"),
          description: z.string().optional().describe("Descrição ou ingredientes"),
          price: z.string().describe("Preço em formato decimal (ex: '29.90')"),
        })
      ),
    })
  ),
  notes: z
    .string()
    .optional()
    .describe("Observações sobre itens que não puderam ser lidos ou outras notas"),
});

export type ExtractedMenu = z.infer<typeof extractedMenuSchema>;
