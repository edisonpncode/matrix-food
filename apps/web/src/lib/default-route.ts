"use client";

import { useMemo } from "react";
import { useActiveUser, type LoggedUser } from "@/lib/logged-users-store";

/**
 * Rota padrão ("casa") para o usuário ativo — usada como destino seguro
 * quando cai numa tela sem permissão ("Voltar para início").
 *
 * Regras:
 * - OWNER / kind === "admin" sempre recebe o Dashboard.
 * - Caso contrário, percorre a lista de prioridade abaixo e retorna a
 *   primeira entrada cuja permissão o usuário tem.
 * - Fallback final: `/restaurante/admin/mini-max` (Neo Assistente — área
 *   liberada para todos na `RoutePermissionGuard`).
 *
 * A ordem reflete a prioridade típica de onde um funcionário costuma
 * começar o dia: POS → Produtos → Clientes → Config.
 */
const PRIORITY: Array<{ permission: string; href: string }> = [
  { permission: "dashboard.view", href: "/restaurante/admin" },
  { permission: "orders.view", href: "/restaurante/admin/ponto-de-venda/pedidos" },
  { permission: "pos.createOrder", href: "/restaurante/admin/ponto-de-venda/novo-pedido" },
  { permission: "pos.view", href: "/restaurante/admin/ponto-de-venda/pedidos" },
  { permission: "cashRegister.view", href: "/restaurante/admin/ponto-de-venda/caixa" },
  { permission: "motoboys.view", href: "/restaurante/admin/ponto-de-venda/motoboys" },
  { permission: "products.view", href: "/restaurante/admin/produtos" },
  { permission: "categories.view", href: "/restaurante/admin/categorias" },
  { permission: "ingredients.view", href: "/restaurante/admin/ingredientes" },
  { permission: "promotions.view", href: "/restaurante/admin/promocoes" },
  { permission: "customers.view", href: "/restaurante/admin/clientes" },
  { permission: "loyalty.view", href: "/restaurante/admin/fidelidade" },
  { permission: "reviews.view", href: "/restaurante/admin/avaliacoes" },
  { permission: "settings.view", href: "/restaurante/admin/configuracoes" },
  { permission: "deliveryAreas.view", href: "/restaurante/admin/areas-entrega" },
  { permission: "staff.view", href: "/restaurante/admin/equipe" },
  { permission: "printer.manage", href: "/restaurante/admin/configuracoes/impressora" },
  { permission: "fiscal.view", href: "/restaurante/admin/fiscal" },
  { permission: "billing.view", href: "/restaurante/admin/assinatura" },
];

/** Sempre acessível (liberada para todos em RoutePermissionGuard). */
const NEO_ASSISTANT = "/restaurante/admin/mini-max";

/**
 * Versão pura (sem hook). Útil para lógica fora de componentes.
 */
export function getDefaultRouteFor(
  user: LoggedUser | null | undefined
): string {
  if (!user) return NEO_ASSISTANT;
  // OWNER / admin → Dashboard
  if (user.role === "OWNER" || user.kind === "admin") {
    return "/restaurante/admin";
  }
  const perms = user.permissions ?? {};
  for (const { permission, href } of PRIORITY) {
    if (perms[permission] === true) return href;
  }
  return NEO_ASSISTANT;
}

/**
 * Hook que retorna a rota padrão ("casa") do usuário ativo.
 * Use em botões "Voltar para início" / telas de acesso negado.
 */
export function useDefaultRoute(): string {
  const user = useActiveUser();
  return useMemo(() => getDefaultRouteFor(user), [user]);
}
