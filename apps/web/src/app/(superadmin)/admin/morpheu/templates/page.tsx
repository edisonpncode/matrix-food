"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Check } from "lucide-react";

const STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PAUSED",
  "DISABLED",
] as const;

type Status = (typeof STATUSES)[number];

export default function MorpheuTemplatesPage() {
  const utils = trpc.useUtils();
  const listQ = trpc.morpheu.templates.list.useQuery();
  const upsertMut = trpc.morpheu.templates.upsert.useMutation({
    onSuccess: () => utils.morpheu.templates.list.invalidate(),
  });

  const [editing, setEditing] = useState<
    Record<string, { status: Status; metaTemplateId: string }>
  >({});

  function setField(
    name: string,
    patch: Partial<{ status: Status; metaTemplateId: string }>
  ) {
    setEditing((prev) => ({
      ...prev,
      [name]: {
        status: prev[name]?.status ?? "DRAFT",
        metaTemplateId: prev[name]?.metaTemplateId ?? "",
        ...patch,
      },
    }));
  }

  if (listQ.isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Morpheu — Templates</h1>
        <p className="text-sm text-muted-foreground">
          Registre aqui o status atual de cada template no Meta Business
          Manager. O corpo precisa bater exatamente — crie no Meta com o mesmo
          nome técnico.
        </p>
      </div>

      <div className="space-y-3">
        {listQ.data?.map((tpl) => {
          const live = editing[tpl.name] ?? {
            status: tpl.status as Status,
            metaTemplateId: tpl.metaTemplateId ?? "",
          };
          const changed =
            live.status !== tpl.status ||
            live.metaTemplateId !== (tpl.metaTemplateId ?? "");
          return (
            <div key={tpl.name} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm font-semibold">
                      {tpl.name}
                    </code>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {tpl.category}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {tpl.language}
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl whitespace-pre-line text-sm">
                    {tpl.body}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Placeholders: {tpl.placeholders.join(", ")}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    tpl.status === "APPROVED"
                      ? "bg-green-100 text-green-700"
                      : tpl.status === "REJECTED" || tpl.status === "DISABLED"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {tpl.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr_auto]">
                <select
                  value={live.status}
                  onChange={(e) =>
                    setField(tpl.name, { status: e.target.value as Status })
                  }
                  className="rounded-lg border px-2 py-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  value={live.metaTemplateId}
                  onChange={(e) =>
                    setField(tpl.name, { metaTemplateId: e.target.value })
                  }
                  placeholder="Meta Template ID (opcional)"
                  className="rounded-lg border px-3 py-2 text-sm"
                />
                <button
                  disabled={!changed || upsertMut.isPending}
                  onClick={() =>
                    upsertMut.mutate({
                      name: tpl.name,
                      status: live.status,
                      metaTemplateId: live.metaTemplateId || null,
                    })
                  }
                  className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40"
                >
                  <Check className="h-4 w-4" />
                  Salvar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
