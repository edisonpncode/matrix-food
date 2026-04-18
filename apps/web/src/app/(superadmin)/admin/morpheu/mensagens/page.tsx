"use client";

import { trpc } from "@/lib/trpc";

export default function MorpheuMensagensPage() {
  const q = trpc.morpheu.messages.listAll.useQuery({ limit: 100 });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Morpheu — Auditoria</h1>
        <p className="text-sm text-muted-foreground">
          Últimas 100 mensagens, de todos os tenants.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Restaurante</th>
              <th className="px-4 py-3">Direção</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Conteúdo</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {new Date(m.createdAt).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3">{m.tenantName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.direction === "INBOUND"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {m.direction}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{m.phoneE164}</td>
                <td className="max-w-xs truncate px-4 py-3">
                  {m.templateName ? (
                    <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs">
                      {m.templateName}
                    </span>
                  ) : null}
                  {m.body ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.status === "FAILED"
                        ? "bg-red-100 text-red-700"
                        : m.status === "READ" || m.status === "DELIVERED"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                    }`}
                    title={m.errorMessage ?? undefined}
                  >
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {q.data?.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Sem mensagens ainda.
          </div>
        )}
      </div>
    </div>
  );
}
