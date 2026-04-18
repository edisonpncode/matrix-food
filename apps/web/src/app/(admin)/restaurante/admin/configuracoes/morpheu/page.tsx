"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import {
  Loader2,
  Save,
  UserPlus,
  UserX,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Crown,
  Phone,
} from "lucide-react";

type Tab = "notificacoes" | "pessoas" | "historico";

export default function MorpheuConfigTenantPage() {
  const utils = trpc.useUtils();
  const settingsQ = trpc.morpheu.settings.get.useQuery();
  const authUsersQ = trpc.morpheu.authorizedUsers.list.useQuery();
  const staffQ = trpc.staff.list.useQuery();
  const messagesQ = trpc.morpheu.messages.listForTenant.useQuery({
    limit: 100,
  });

  const upsertMut = trpc.morpheu.settings.upsert.useMutation({
    onSuccess: () => {
      utils.morpheu.settings.get.invalidate();
      setToast({ type: "success", message: "Preferências salvas." });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (err) =>
      setToast({ type: "error", message: err.message ?? "Erro ao salvar." }),
  });
  const ensureOwnerMut = trpc.morpheu.authorizedUsers.ensureOwner.useMutation({
    onSuccess: () => utils.morpheu.authorizedUsers.list.invalidate(),
  });
  const setManagerMut = trpc.morpheu.authorizedUsers.setManager.useMutation({
    onSuccess: () => {
      utils.morpheu.authorizedUsers.list.invalidate();
      setToast({ type: "success", message: "Gerente designado." });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (err) =>
      setToast({ type: "error", message: err.message ?? "Erro" }),
  });
  const deactivateMut = trpc.morpheu.authorizedUsers.deactivate.useMutation({
    onSuccess: () => utils.morpheu.authorizedUsers.list.invalidate(),
  });

  const [tab, setTab] = useState<Tab>("notificacoes");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [settings, setSettings] = useState({
    enabled: false,
    notifyCashOpen: true,
    notifyCashDeposit: true,
    notifyCashWithdraw: true,
    notifyOrderCancel: true,
    notifyCashClose: true,
    notifyDailySummary: true,
    notifyAnomalyAlerts: true,
    quietHoursStart: "00:00",
    quietHoursEnd: "07:00",
    digestModeEnabled: false,
    digestWindowStart: "19:00",
    digestWindowEnd: "22:00",
    digestIntervalMinutes: 30,
    timezone: "America/Sao_Paulo",
  });

  useEffect(() => {
    const s = settingsQ.data;
    if (!s) return;
    setSettings({
      enabled: s.enabled,
      notifyCashOpen: s.notifyCashOpen,
      notifyCashDeposit: s.notifyCashDeposit,
      notifyCashWithdraw: s.notifyCashWithdraw,
      notifyOrderCancel: s.notifyOrderCancel,
      notifyCashClose: s.notifyCashClose,
      notifyDailySummary: s.notifyDailySummary,
      notifyAnomalyAlerts: s.notifyAnomalyAlerts,
      quietHoursStart: s.quietHoursStart,
      quietHoursEnd: s.quietHoursEnd,
      digestModeEnabled: s.digestModeEnabled,
      digestWindowStart: s.digestWindowStart,
      digestWindowEnd: s.digestWindowEnd,
      digestIntervalMinutes: s.digestIntervalMinutes,
      timezone: s.timezone,
    });
  }, [settingsQ.data]);

  // Garante linha OWNER na primeira visita
  useEffect(() => {
    if (!authUsersQ.data) return;
    const hasOwner = authUsersQ.data.some(
      (u) => u.role === "OWNER" && u.active
    );
    if (!hasOwner && !ensureOwnerMut.isPending && !ensureOwnerMut.isSuccess) {
      ensureOwnerMut.mutate();
    }
  }, [authUsersQ.data, ensureOwnerMut]);

  const owner = authUsersQ.data?.find((u) => u.role === "OWNER" && u.active);
  const manager = authUsersQ.data?.find(
    (u) => u.role === "MANAGER" && u.active
  );

  const candidateStaff = (staffQ.data ?? []).filter(
    (s) => s.isActive && s.role !== "OWNER"
  );

  if (settingsQ.isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <MessageCircle className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Morpheu</h1>
          <p className="text-sm text-muted-foreground">
            Gerente de IA da Matrix Food via WhatsApp. Configure quais notificações
            seu restaurante recebe e quem tem acesso.
          </p>
        </div>
        <Link
          href="/restaurante/admin/configuracoes/morpheu/meu-acesso"
          className="ml-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
        >
          <Phone className="h-4 w-4" />
          Meu acesso
        </Link>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-lg border px-4 py-2 text-sm ${
            toast.type === "success"
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <TabButton tab="notificacoes" current={tab} onChange={setTab}>
          Notificações
        </TabButton>
        <TabButton tab="pessoas" current={tab} onChange={setTab}>
          Pessoas autorizadas
        </TabButton>
        <TabButton tab="historico" current={tab} onChange={setTab}>
          Histórico
        </TabButton>
      </div>

      {tab === "notificacoes" && (
        <div className="space-y-6">
          {/* Master switch */}
          <div className="rounded-xl border bg-card p-5">
            <label className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Ativar Morpheu neste restaurante</p>
                <p className="text-sm text-muted-foreground">
                  Se desligado, nenhum evento é enviado por WhatsApp.
                </p>
              </div>
              <Toggle
                checked={settings.enabled}
                onChange={(v) => setSettings({ ...settings, enabled: v })}
              />
            </label>
          </div>

          {/* Eventos */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 font-semibold">O que notificar</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Switch
                label="Abertura de caixa"
                checked={settings.notifyCashOpen}
                onChange={(v) =>
                  setSettings({ ...settings, notifyCashOpen: v })
                }
              />
              <Switch
                label="Depósito no caixa"
                checked={settings.notifyCashDeposit}
                onChange={(v) =>
                  setSettings({ ...settings, notifyCashDeposit: v })
                }
              />
              <Switch
                label="Retirada do caixa"
                checked={settings.notifyCashWithdraw}
                onChange={(v) =>
                  setSettings({ ...settings, notifyCashWithdraw: v })
                }
              />
              <Switch
                label="Cancelamento de pedido"
                checked={settings.notifyOrderCancel}
                onChange={(v) =>
                  setSettings({ ...settings, notifyOrderCancel: v })
                }
              />
              <Switch
                label="Fechamento de caixa"
                checked={settings.notifyCashClose}
                onChange={(v) =>
                  setSettings({ ...settings, notifyCashClose: v })
                }
              />
              <Switch
                label="Resumo diário (manhã)"
                checked={settings.notifyDailySummary}
                onChange={(v) =>
                  setSettings({ ...settings, notifyDailySummary: v })
                }
              />
              <Switch
                label="Alerta de anomalia"
                checked={settings.notifyAnomalyAlerts}
                onChange={(v) =>
                  setSettings({ ...settings, notifyAnomalyAlerts: v })
                }
              />
            </div>
          </div>

          {/* Quiet hours */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-2 font-semibold">Não perturbe</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Durante esta janela, apenas alertas de anomalia (se ativos) serão
              enviados. Use formato HH:mm.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TimeField
                label="Início"
                value={settings.quietHoursStart}
                onChange={(v) =>
                  setSettings({ ...settings, quietHoursStart: v })
                }
              />
              <TimeField
                label="Fim"
                value={settings.quietHoursEnd}
                onChange={(v) =>
                  setSettings({ ...settings, quietHoursEnd: v })
                }
              />
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button
              onClick={() => upsertMut.mutate(settings)}
              disabled={upsertMut.isPending}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {upsertMut.isPending ? "Salvando..." : "Salvar preferências"}
            </button>
          </div>
        </div>
      )}

      {tab === "pessoas" && (
        <div className="space-y-4">
          {/* Dono */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-yellow-600" />
              <div className="flex-1">
                <p className="font-semibold">Dono do restaurante</p>
                <p className="text-sm text-muted-foreground">
                  Acesso sempre ativo — não pode ser removido.
                </p>
                <p className="mt-2 text-sm">
                  Status:{" "}
                  {owner?.phoneVerified ? (
                    <span className="text-green-700">
                      <CheckCircle2 className="mr-1 inline h-4 w-4" />
                      Telefone verificado — {owner.phoneE164}
                    </span>
                  ) : owner?.phoneE164 ? (
                    <span className="text-yellow-700">
                      Aguardando verificação de {owner.phoneE164}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Nenhum telefone cadastrado. Acesse seu perfil pra cadastrar.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Manager */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-2 font-semibold">Gerente (opcional)</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Você pode designar 1 funcionário adicional pra receber notificações
              e conversar com o Morpheu. Desative pra liberar o slot.
            </p>

            {manager ? (
              <div className="flex items-start justify-between rounded-lg bg-muted/50 p-4">
                <div>
                  <p className="font-medium">
                    {manager.tenantUserName ?? "Sem nome"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {manager.tenantUserEmail}
                  </p>
                  <p className="mt-1 text-sm">
                    {manager.phoneVerified ? (
                      <span className="text-green-700">
                        <CheckCircle2 className="mr-1 inline h-4 w-4" />
                        Telefone verificado — {manager.phoneE164}
                      </span>
                    ) : manager.phoneE164 ? (
                      <span className="text-yellow-700">
                        Aguardando verificação de {manager.phoneE164}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Nenhum telefone cadastrado.
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() =>
                    deactivateMut.mutate({ id: manager.id }, {
                      onSuccess: () =>
                        setToast({
                          type: "success",
                          message: "Gerente desativado.",
                        }),
                    })
                  }
                  disabled={deactivateMut.isPending}
                  className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                >
                  <UserX className="h-4 w-4" />
                  Desativar
                </button>
              </div>
            ) : (
              <DesignateManager
                candidates={candidateStaff}
                onDesignate={(id) => setManagerMut.mutate({ tenantUserId: id })}
                pending={setManagerMut.isPending}
              />
            )}
          </div>
        </div>
      )}

      {tab === "historico" && (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Direção</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Conteúdo</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {messagesQ.data?.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString("pt-BR")}
                  </td>
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
                  <td className="px-4 py-3 font-mono text-xs">
                    {m.phoneE164}
                  </td>
                  <td className="max-w-md truncate px-4 py-3">
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
          {messagesQ.data?.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Sem mensagens ainda.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({
  tab,
  current,
  onChange,
  children,
}: {
  tab: Tab;
  current: Tab;
  onChange: (t: Tab) => void;
  children: React.ReactNode;
}) {
  const active = tab === current;
  return (
    <button
      onClick={() => onChange(tab)}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-b-2 border-primary text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <span className="text-sm">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </label>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function DesignateManager({
  candidates,
  onDesignate,
  pending,
}: {
  candidates: Array<{ id: string; name: string | null; email: string | null }>;
  onDesignate: (id: string) => void;
  pending: boolean;
}) {
  const [picked, setPicked] = useState("");
  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        <XCircle className="mx-auto mb-2 h-6 w-6" />
        Nenhum funcionário ativo elegível. Cadastre primeiro em &quot;Funcionários&quot;.
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[220px]">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Escolha um funcionário
        </label>
        <select
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Selecione...</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name ?? "Sem nome"} {c.email ? `— ${c.email}` : ""}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={() => picked && onDesignate(picked)}
        disabled={!picked || pending}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
      >
        <UserPlus className="h-4 w-4" />
        {pending ? "Designando..." : "Designar gerente"}
      </button>
    </div>
  );
}
