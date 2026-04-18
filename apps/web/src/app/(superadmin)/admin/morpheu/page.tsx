"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import {
  MessageCircle,
  FileText,
  Inbox,
  AlertCircle,
  Settings,
} from "lucide-react";

export default function MorpheuDashboardPage() {
  const configQ = trpc.morpheu.config.get.useQuery();
  const statsQ = trpc.morpheu.messages.stats.useQuery();

  const cfg = configQ.data;
  const stats = statsQ.data;

  const configured =
    cfg && cfg.exists && cfg.hasAccessToken && cfg.hasWebhookSecret;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Morpheu</h1>
        <p className="text-sm text-muted-foreground">
          Gerente de IA via WhatsApp — configuração global e auditoria.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Status da integração</h2>
            <p className="text-sm text-muted-foreground">
              {configured
                ? cfg?.enabled
                  ? "Configurado e habilitado."
                  : "Configurado, porém desabilitado globalmente."
                : "Credenciais Meta ainda não foram configuradas."}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              configured && cfg?.enabled
                ? "bg-green-100 text-green-700"
                : configured
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {configured && cfg?.enabled
              ? "Ativo"
              : configured
                ? "Pausado"
                : "Não configurado"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<MessageCircle className="h-5 w-5" />}
          label="Mensagens totais"
          value={stats?.total ?? 0}
        />
        <StatCard
          icon={<Inbox className="h-5 w-5" />}
          label="Recebidas"
          value={stats?.inbound ?? 0}
        />
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label="Enviadas"
          value={stats?.outbound ?? 0}
        />
        <StatCard
          icon={<AlertCircle className="h-5 w-5 text-red-500" />}
          label="Falhas"
          value={stats?.failed ?? 0}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <ActionCard
          href="/admin/morpheu/configuracao"
          icon={<Settings className="h-6 w-6" />}
          title="Configuração"
          description="Credenciais Meta, webhook e prompt padrão."
        />
        <ActionCard
          href="/admin/morpheu/templates"
          icon={<FileText className="h-6 w-6" />}
          title="Templates"
          description="Registre os templates aprovados no Meta."
        />
        <ActionCard
          href="/admin/morpheu/mensagens"
          icon={<MessageCircle className="h-6 w-6" />}
          title="Auditoria"
          description="Últimas mensagens inbound/outbound."
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-xl border bg-card p-5 transition-colors hover:border-primary hover:bg-accent"
    >
      <div className="text-primary">{icon}</div>
      <h3 className="font-semibold group-hover:text-primary">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
