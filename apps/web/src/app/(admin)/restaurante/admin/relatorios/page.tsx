"use client";

import Link from "next/link";
import {
  TrendingUp,
  Package,
  UserCircle,
  Star,
  Clock,
  Banknote,
  Tag,
  MapPin,
  MessageSquare,
  FileText,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ReportShell } from "@/components/reports";

interface CategoryTile {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  href: string;
  /** Quando true, o tile é renderizado como placeholder não clicável. */
  comingSoon?: boolean;
}

const CATEGORIES: CategoryTile[] = [
  {
    id: "vendas",
    title: "Vendas",
    description:
      "Faturamento, ticket médio, sazonalidade e comparativo entre períodos.",
    icon: TrendingUp,
    iconColor: "text-green-600",
    iconBg: "bg-green-50",
    href: "/restaurante/admin/relatorios/vendas",
    comingSoon: true,
  },
  {
    id: "produtos",
    title: "Produtos",
    description:
      "Mais vendidos, curva ABC, performance por categoria e ingredientes.",
    icon: Package,
    iconColor: "text-purple-600",
    iconBg: "bg-purple-50",
    href: "/restaurante/admin/relatorios/produtos",
    comingSoon: true,
  },
  {
    id: "clientes",
    title: "Clientes",
    description:
      "Novos vs recorrentes, top clientes, RFM, churn e ciclo de recompra.",
    icon: UserCircle,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
    href: "/restaurante/admin/relatorios/clientes",
    comingSoon: true,
  },
  {
    id: "fidelidade",
    title: "Fidelidade",
    description:
      "Pontos emitidos vs resgatados, top resgatadores e passivo do programa.",
    icon: Star,
    iconColor: "text-yellow-600",
    iconBg: "bg-yellow-50",
    href: "/restaurante/admin/relatorios/fidelidade",
    comingSoon: true,
  },
  {
    id: "operacional",
    title: "Operacional",
    description:
      "Tempo de preparo, cancelamentos e produtividade da equipe.",
    icon: Clock,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-50",
    href: "/restaurante/admin/relatorios/operacional",
    comingSoon: true,
  },
  {
    id: "caixa",
    title: "Caixa",
    description:
      "Sessões, conciliação, sangrias e diferenças entre esperado e contado.",
    icon: Banknote,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
    href: "/restaurante/admin/relatorios/caixa",
    comingSoon: true,
  },
  {
    id: "promocoes",
    title: "Promoções",
    description: "Uso, desconto concedido e ROI de cada promoção.",
    icon: Tag,
    iconColor: "text-pink-600",
    iconBg: "bg-pink-50",
    href: "/restaurante/admin/relatorios/promocoes",
    comingSoon: true,
  },
  {
    id: "entregas",
    title: "Entregas",
    description:
      "Tempo médio por área, ranking de bairros, motoboys e mapa de calor.",
    icon: MapPin,
    iconColor: "text-cyan-600",
    iconBg: "bg-cyan-50",
    href: "/restaurante/admin/relatorios/entregas",
    comingSoon: true,
  },
  {
    id: "avaliacoes",
    title: "Avaliações",
    description:
      "Nota média, distribuição de estrelas e tendência ao longo do tempo.",
    icon: MessageSquare,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
    href: "/restaurante/admin/relatorios/avaliacoes",
    comingSoon: true,
  },
  {
    id: "fiscal",
    title: "Fiscal",
    description:
      "NFe emitidas, canceladas, erros e exportação para o contador.",
    icon: FileText,
    iconColor: "text-slate-600",
    iconBg: "bg-slate-100",
    href: "/restaurante/admin/relatorios/fiscal",
    comingSoon: true,
  },
  {
    id: "comunicacao",
    title: "Comunicação",
    description:
      "Mensagens via WhatsApp/Morpheu e conversões em pedido.",
    icon: MessageCircle,
    iconColor: "text-teal-600",
    iconBg: "bg-teal-50",
    href: "/restaurante/admin/relatorios/comunicacao",
    comingSoon: true,
  },
];

export default function RelatoriosHubPage() {
  return (
    <ReportShell
      title="Relatórios"
      description="Análise completa do seu restaurante. Escolha uma categoria abaixo."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => (
          <Tile key={cat.id} {...cat} />
        ))}
      </div>
    </ReportShell>
  );
}

function Tile({
  title,
  description,
  icon: Icon,
  iconColor,
  iconBg,
  href,
  comingSoon,
}: CategoryTile) {
  const content = (
    <div
      className={`group relative flex h-full flex-col gap-3 rounded-xl border bg-card p-5 transition-all ${
        comingSoon
          ? "cursor-not-allowed opacity-60"
          : "hover:border-primary hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`rounded-lg ${iconBg} p-3`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        {comingSoon ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Em breve
          </span>
        ) : (
          <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        )}
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );

  if (comingSoon) {
    return <div aria-disabled>{content}</div>;
  }

  return <Link href={href}>{content}</Link>;
}
