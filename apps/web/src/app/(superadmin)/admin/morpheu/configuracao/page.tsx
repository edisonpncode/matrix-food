"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Check, Save, Zap } from "lucide-react";

export default function MorpheuConfigPage() {
  const utils = trpc.useUtils();
  const cfgQ = trpc.morpheu.config.get.useQuery();
  const updateMut = trpc.morpheu.config.update.useMutation({
    onSuccess: () => {
      utils.morpheu.config.get.invalidate();
    },
  });
  const testMut = trpc.morpheu.config.testConnection.useMutation();

  const [form, setForm] = useState({
    metaAppId: "",
    accessToken: "",
    metaPhoneNumberId: "",
    metaBusinessAccountId: "",
    graphApiVersion: "v21.0",
    webhookVerifyToken: "",
    webhookSecret: "",
    displayName: "Morpheu",
    defaultSystemPrompt: "",
    enabled: false,
  });

  useEffect(() => {
    if (!cfgQ.data || !cfgQ.data.exists) return;
    setForm((f) => ({
      ...f,
      metaAppId: cfgQ.data.metaAppId ?? "",
      metaPhoneNumberId: cfgQ.data.metaPhoneNumberId ?? "",
      metaBusinessAccountId: cfgQ.data.metaBusinessAccountId ?? "",
      graphApiVersion: cfgQ.data.graphApiVersion ?? "v21.0",
      webhookVerifyToken: cfgQ.data.webhookVerifyToken ?? "",
      displayName: cfgQ.data.displayName ?? "Morpheu",
      defaultSystemPrompt: cfgQ.data.defaultSystemPrompt ?? "",
      enabled: cfgQ.data.enabled ?? false,
    }));
  }, [cfgQ.data]);

  function handleSave() {
    const payload: Record<string, unknown> = {
      metaAppId: form.metaAppId,
      metaPhoneNumberId: form.metaPhoneNumberId,
      metaBusinessAccountId: form.metaBusinessAccountId || null,
      graphApiVersion: form.graphApiVersion,
      webhookVerifyToken: form.webhookVerifyToken,
      displayName: form.displayName,
      defaultSystemPrompt: form.defaultSystemPrompt || null,
      enabled: form.enabled,
    };
    if (form.accessToken.trim()) payload.accessToken = form.accessToken.trim();
    if (form.webhookSecret.trim())
      payload.webhookSecret = form.webhookSecret.trim();
    updateMut.mutate(payload);
  }

  if (cfgQ.isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const cfg = cfgQ.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Morpheu — Configuração</h1>
        <p className="text-sm text-muted-foreground">
          Credenciais da WhatsApp Business Cloud API (Meta).
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Meta App ID"
            value={form.metaAppId}
            onChange={(v) => setForm({ ...form, metaAppId: v })}
            placeholder="123456789012345"
          />
          <Field
            label="Phone Number ID"
            value={form.metaPhoneNumberId}
            onChange={(v) => setForm({ ...form, metaPhoneNumberId: v })}
            placeholder="109876543210987"
          />
          <Field
            label="Business Account ID (opcional)"
            value={form.metaBusinessAccountId}
            onChange={(v) => setForm({ ...form, metaBusinessAccountId: v })}
          />
          <Field
            label="Graph API version"
            value={form.graphApiVersion}
            onChange={(v) => setForm({ ...form, graphApiVersion: v })}
            placeholder="v21.0"
          />
          <Field
            label={
              cfg?.exists && cfg.hasAccessToken
                ? "Access Token (deixe vazio pra manter o atual)"
                : "Access Token"
            }
            value={form.accessToken}
            onChange={(v) => setForm({ ...form, accessToken: v })}
            placeholder="EAAG..."
            type="password"
          />
          <Field
            label="Webhook verify token"
            value={form.webhookVerifyToken}
            onChange={(v) => setForm({ ...form, webhookVerifyToken: v })}
            placeholder="string aleatória"
          />
          <Field
            label={
              cfg?.exists && cfg.hasWebhookSecret
                ? "Webhook secret (deixe vazio pra manter o atual)"
                : "Webhook secret (App Secret)"
            }
            value={form.webhookSecret}
            onChange={(v) => setForm({ ...form, webhookSecret: v })}
            type="password"
          />
          <Field
            label="Nome de exibição"
            value={form.displayName}
            onChange={(v) => setForm({ ...form, displayName: v })}
            placeholder="Morpheu"
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">
            System prompt padrão (opcional)
          </label>
          <textarea
            value={form.defaultSystemPrompt}
            onChange={(e) =>
              setForm({ ...form, defaultSystemPrompt: e.target.value })
            }
            rows={6}
            className="w-full rounded-lg border px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Instruções extras que serão anexadas ao prompt base do Morpheu."
          />
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="accent-primary"
            />
            Habilitar integração globalmente
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={handleSave}
            disabled={updateMut.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateMut.isPending ? "Salvando..." : "Salvar"}
          </button>
          <button
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending || !cfg?.exists}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            {testMut.isPending ? "Testando..." : "Testar conexão"}
          </button>
        </div>

        {updateMut.isSuccess && (
          <p className="mt-3 flex items-center gap-2 text-sm text-green-700">
            <Check className="h-4 w-4" />
            Configuração salva.
          </p>
        )}
        {updateMut.isError && (
          <p className="mt-3 text-sm text-red-700">{updateMut.error.message}</p>
        )}
        {testMut.data && (
          <p
            className={`mt-3 text-sm ${
              testMut.data.ok ? "text-green-700" : "text-red-700"
            }`}
          >
            {testMut.data.ok
              ? `Conexão OK${
                  testMut.data.displayPhoneNumber
                    ? ` — número ${testMut.data.displayPhoneNumber}`
                    : ""
                }`
              : `Falha: ${testMut.data.error ?? "desconhecida"}`}
          </p>
        )}
        {testMut.isError && (
          <p className="mt-3 text-sm text-red-700">{testMut.error.message}</p>
        )}
      </div>

      <div className="rounded-xl border bg-muted/30 p-6 text-sm">
        <h2 className="mb-2 font-semibold">Webhook URL</h2>
        <p className="text-muted-foreground">
          Configure no Meta Business Manager:
        </p>
        <code className="mt-2 block rounded bg-background px-3 py-2 font-mono text-xs">
          https://SEU-DOMINIO/api/webhooks/whatsapp
        </code>
        <p className="mt-3 text-xs text-muted-foreground">
          Use o <strong>Webhook verify token</strong> acima como{" "}
          <em>Verify Token</em> e o <strong>Webhook secret</strong> como{" "}
          <em>App Secret</em>.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
