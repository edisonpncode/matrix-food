import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure, publicProcedure } from "../trpc";
import {
  getDb,
  deliveryAreas,
  eq,
  and,
  desc,
  asc,
} from "@matrix-food/database";
import { pointInPolygon } from "@matrix-food/utils";

// --- Schemas de validacao ---

const coordinateSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

const scheduleSchema = z.object({
  enabled: z.boolean(),
  days: z.array(z.number().int().min(0).max(6)),
  startTime: z.string(), // formato "HH:mm"
  endTime: z.string(), // formato "HH:mm"
});

// --- Router ---

export const deliveryAreaRouter = createTRPCRouter({
  /**
   * Lista todas as areas de entrega do tenant.
   * Por padrao, retorna apenas areas ativas.
   */
  list: tenantProcedure
    .input(
      z
        .object({
          includeInactive: z.boolean().default(false),
        })
        .optional()
        .default({})
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const conditions = [eq(deliveryAreas.tenantId, ctx.tenantId)];

      if (!input.includeInactive) {
        conditions.push(eq(deliveryAreas.isActive, true));
      }

      const areas = await db
        .select()
        .from(deliveryAreas)
        .where(and(...conditions))
        .orderBy(asc(deliveryAreas.sortOrder));

      return areas;
    }),

  /**
   * Cria uma nova area de entrega.
   */
  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nome e obrigatorio"),
        polygon: z
          .array(coordinateSchema)
          .min(3, "O poligono precisa ter pelo menos 3 pontos"),
        deliveryFee: z.string().regex(/^\d+(\.\d{1,2})?$/, "Taxa invalida"),
        estimatedMinutes: z.number().int().positive().optional(),
        freeDeliveryAbove: z
          .string()
          .regex(/^\d+(\.\d{1,2})?$/, "Valor invalido")
          .optional(),
        schedule: scheduleSchema.optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, "Cor invalida")
          .default("#3b82f6"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Determine sort order: place at end
      const existing = await db
        .select({ sortOrder: deliveryAreas.sortOrder })
        .from(deliveryAreas)
        .where(eq(deliveryAreas.tenantId, ctx.tenantId))
        .orderBy(desc(deliveryAreas.sortOrder))
        .limit(1);

      const nextSortOrder =
        existing.length > 0 ? existing[0]!.sortOrder + 1 : 0;

      const [created] = await db
        .insert(deliveryAreas)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          polygon: input.polygon,
          deliveryFee: input.deliveryFee,
          estimatedMinutes: input.estimatedMinutes ?? null,
          freeDeliveryAbove: input.freeDeliveryAbove ?? null,
          schedule: input.schedule ?? null,
          color: input.color,
          sortOrder: nextSortOrder,
        })
        .returning();

      return created;
    }),

  /**
   * Atualiza uma area de entrega existente.
   */
  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        polygon: z.array(coordinateSchema).min(3).optional(),
        deliveryFee: z
          .string()
          .regex(/^\d+(\.\d{1,2})?$/)
          .optional(),
        estimatedMinutes: z.number().int().positive().nullable().optional(),
        freeDeliveryAbove: z
          .string()
          .regex(/^\d+(\.\d{1,2})?$/)
          .nullable()
          .optional(),
        schedule: scheduleSchema.nullable().optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verify ownership
      const [existing] = await db
        .select({ id: deliveryAreas.id })
        .from(deliveryAreas)
        .where(
          and(
            eq(deliveryAreas.id, input.id),
            eq(deliveryAreas.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Area de entrega nao encontrada.",
        });
      }

      const { id, ...updateData } = input;

      // Remove undefined fields so we only update what was provided
      const cleanData = Object.fromEntries(
        Object.entries(updateData).filter(([, v]) => v !== undefined)
      );

      if (Object.keys(cleanData).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhum campo para atualizar.",
        });
      }

      const [updated] = await db
        .update(deliveryAreas)
        .set(cleanData)
        .where(eq(deliveryAreas.id, id))
        .returning();

      return updated;
    }),

  /**
   * Remove uma area de entrega (hard delete).
   */
  delete: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verify ownership
      const [existing] = await db
        .select({ id: deliveryAreas.id })
        .from(deliveryAreas)
        .where(
          and(
            eq(deliveryAreas.id, input.id),
            eq(deliveryAreas.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Area de entrega nao encontrada.",
        });
      }

      await db.delete(deliveryAreas).where(eq(deliveryAreas.id, input.id));

      return { success: true } as const;
    }),

  /**
   * Verifica se um endereco (lat/lng) esta dentro de alguma area de entrega ativa.
   * Retorna a area correspondente ou null.
   */
  checkAddress: tenantProcedure
    .input(
      z.object({
        lat: z.number(),
        lng: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const areas = await db
        .select()
        .from(deliveryAreas)
        .where(
          and(
            eq(deliveryAreas.tenantId, ctx.tenantId),
            eq(deliveryAreas.isActive, true)
          )
        )
        .orderBy(asc(deliveryAreas.sortOrder));

      const point = { lat: input.lat, lng: input.lng };

      for (const area of areas) {
        if (!pointInPolygon(point, area.polygon)) {
          continue;
        }

        // Check schedule restriction if enabled
        if (area.schedule?.enabled) {
          const now = new Date();
          const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
          const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

          const { days, startTime, endTime } = area.schedule;

          // Check if today is in the allowed days
          if (!days.includes(currentDay)) {
            continue;
          }

          // Check if current time is within the allowed window
          if (startTime <= endTime) {
            // Normal range: e.g. 08:00 - 22:00
            if (currentTime < startTime || currentTime > endTime) {
              continue;
            }
          } else {
            // Overnight range: e.g. 22:00 - 06:00
            if (currentTime < startTime && currentTime > endTime) {
              continue;
            }
          }
        }

        return {
          id: area.id,
          name: area.name,
          deliveryFee: area.deliveryFee,
          estimatedMinutes: area.estimatedMinutes,
          freeDeliveryAbove: area.freeDeliveryAbove,
        };
      }

      return null;
    }),

  /**
   * Versao publica do checkAddress - aceita tenantId como input.
   * Usada pelo checkout do cliente (sem autenticacao).
   */
  checkAddressPublic: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        lat: z.number(),
        lng: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();

      const areas = await db
        .select()
        .from(deliveryAreas)
        .where(
          and(
            eq(deliveryAreas.tenantId, input.tenantId),
            eq(deliveryAreas.isActive, true)
          )
        )
        .orderBy(asc(deliveryAreas.sortOrder));

      const point = { lat: input.lat, lng: input.lng };

      for (const area of areas) {
        if (!pointInPolygon(point, area.polygon)) {
          continue;
        }

        // Check schedule restriction if enabled
        if (area.schedule?.enabled) {
          const now = new Date();
          const currentDay = now.getDay();
          const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

          const { days, startTime, endTime } = area.schedule;

          if (!days.includes(currentDay)) {
            continue;
          }

          if (startTime <= endTime) {
            if (currentTime < startTime || currentTime > endTime) {
              continue;
            }
          } else {
            if (currentTime < startTime && currentTime > endTime) {
              continue;
            }
          }
        }

        return {
          id: area.id,
          name: area.name,
          deliveryFee: area.deliveryFee,
          estimatedMinutes: area.estimatedMinutes,
          freeDeliveryAbove: area.freeDeliveryAbove,
        };
      }

      return null;
    }),

  /**
   * Geocodifica um endereco usando a API do Nominatim (OpenStreetMap).
   * Tenta multiplas variacoes de query (estruturada, com/sem bairro, so rua)
   * porque enderecos brasileiros nem sempre estao indexados por numero exato.
   * Retorna coordenadas lat/lng ou null se nao encontrado.
   */
  geocodeAddress: publicProcedure
    .input(
      z.object({
        street: z.string().min(1, "Rua e obrigatoria"),
        number: z.string().min(1, "Numero e obrigatorio"),
        neighborhood: z.string().optional(),
        city: z.string().min(1, "Cidade e obrigatoria"),
        state: z.string().min(1, "Estado e obrigatorio"),
      })
    )
    .query(async ({ input }) => {
      const streetFull = `${input.street} ${input.number}`;
      const cityVal = input.city;
      const stateVal = input.state;
      const neighborhoodVal = input.neighborhood?.trim() ?? "";

      const queries: string[] = [
        // 1. Structured: street/city/state/country params separados
        `https://nominatim.openstreetmap.org/search?format=json&street=${encodeURIComponent(streetFull)}&city=${encodeURIComponent(cityVal)}&state=${encodeURIComponent(stateVal)}&country=Brazil&limit=3`,
        // 2. Free-text com bairro (se informado)
        ...(neighborhoodVal
          ? [
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${streetFull}, ${neighborhoodVal}, ${cityVal}, ${stateVal}, Brasil`)}&countrycodes=br&limit=3`,
            ]
          : []),
        // 3. Free-text sem bairro
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${streetFull}, ${cityVal}, ${stateVal}, Brasil`)}&countrycodes=br&limit=3`,
        // 4. Apenas nome da rua (fallback final, sem numero)
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${input.street}, ${cityVal}, ${stateVal}, Brasil`)}&countrycodes=br&limit=3`,
      ];

      for (let i = 0; i < queries.length; i++) {
        const url = queries[i]!;
        try {
          const response = await fetch(url, {
            headers: { "User-Agent": "MatrixFood/1.0" },
          });
          if (!response.ok) {
            continue;
          }

          const data = (await response.json()) as Array<{
            lat: string;
            lon: string;
            display_name: string;
            type?: string;
          }>;

          if (data && data.length > 0) {
            // Prefere resultados de "house" ou "residential" para maior precisao
            const best =
              data.find((r) => r.type === "house" || r.type === "residential") ??
              data[0]!;
            if (best.lat && best.lon) {
              return {
                lat: parseFloat(best.lat),
                lng: parseFloat(best.lon),
                displayName: best.display_name,
              };
            }
          }
        } catch {
          continue;
        }
        // Respeita rate limit do Nominatim entre tentativas
        if (i < queries.length - 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      return null;
    }),
});
