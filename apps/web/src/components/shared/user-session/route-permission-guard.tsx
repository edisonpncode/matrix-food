"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePermissions } from "@/lib/permissions";
import { useDefaultRoute } from "@/lib/default-route";
import { PermissionGuard } from "./permission-guard";

/**
 * Mapeia prefixos de rota para a permissão mínima requerida.
 * A primeira entrada que der match com o pathname é usada.
 * Rotas não mapeadas são liberadas.
 */
const ROUTE_PERMISSIONS: Array<{
  prefix: string;
  permission: string | readonly string[];
}> = [
  // Ponto de Venda (tanto /admin/ponto-de-venda quanto /pos)
  { prefix: "/restaurante/admin/ponto-de-venda/novo-pedido", permission: "pos.createOrder" },
  { prefix: "/restaurante/admin/ponto-de-venda/caixa", permission: "cashRegister.view" },
  { prefix: "/restaurante/admin/ponto-de-venda/motoboys", permission: "motoboys.view" },
  { prefix: "/restaurante/admin/ponto-de-venda/pedidos", permission: "orders.view" },
  { prefix: "/restaurante/admin/ponto-de-venda", permission: ["orders.view", "pos.view", "pos.createOrder"] },
  { prefix: "/restaurante/pos/novo-pedido", permission: "pos.createOrder" },
  { prefix: "/restaurante/pos/caixa", permission: "cashRegister.view" },
  { prefix: "/restaurante/pos", permission: ["orders.view", "pos.view", "pos.createOrder"] },

  // Produtos
  { prefix: "/restaurante/admin/categorias", permission: "categories.view" },
  { prefix: "/restaurante/admin/produtos", permission: "products.view" },
  { prefix: "/restaurante/admin/ingredientes", permission: "ingredients.view" },
  { prefix: "/restaurante/admin/promocoes", permission: "promotions.view" },

  // Clientes
  { prefix: "/restaurante/admin/clientes", permission: "customers.view" },
  { prefix: "/restaurante/admin/fidelidade", permission: "loyalty.view" },
  { prefix: "/restaurante/admin/avaliacoes", permission: "reviews.view" },

  // Config
  { prefix: "/restaurante/admin/configuracoes/impressora", permission: "printer.manage" },
  { prefix: "/restaurante/admin/configuracoes", permission: "settings.view" },
  { prefix: "/restaurante/admin/areas-entrega", permission: "deliveryAreas.view" },
  { prefix: "/restaurante/admin/equipe", permission: "staff.view" },
  { prefix: "/restaurante/admin/fiscal", permission: "fiscal.view" },
  { prefix: "/restaurante/admin/assinatura", permission: "billing.view" },

  // Neo Assistente (sempre liberado — fallback universal)
  { prefix: "/restaurante/admin/mini-max", permission: [] },

  // Dashboard raiz — exige dashboard.view. Usuários sem essa permissão
  // são redirecionados para a sua "casa" (primeira área permitida) pelo
  // bloco de redirect logo abaixo. NUNCA usar RoutePermissionGuard para
  // mostrar "Acesso restrito" aqui: o Dashboard raiz deve ser silencioso.
  { prefix: "/restaurante/admin", permission: "dashboard.view" },
];

function matchPermission(pathname: string) {
  for (const { prefix, permission } of ROUTE_PERMISSIONS) {
    if (pathname === prefix || pathname.startsWith(prefix + "/") || pathname === prefix) {
      return permission;
    }
  }
  return null;
}

interface RoutePermissionGuardProps {
  children: React.ReactNode;
}

/**
 * Envolve o conteúdo do layout e bloqueia a página inteira quando o
 * usuário não tem permissão, mostrando a tela "Acesso restrito".
 *
 * A sidebar continua visível (e já filtra seus próprios itens).
 *
 * Caso especial do Dashboard raiz (`/restaurante/admin`): em vez de
 * mostrar "Acesso restrito", redireciona silenciosamente para a rota
 * padrão do usuário (primeira área permitida). Assim um funcionário
 * sem `dashboard.view` nunca fica preso numa tela de negação.
 */
export function RoutePermissionGuard({ children }: RoutePermissionGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, can, canAny } = usePermissions();
  const defaultRoute = useDefaultRoute();

  const requiredPermission = matchPermission(pathname);
  const isAdminRoot = pathname === "/restaurante/admin";
  const allowed =
    requiredPermission === null
      ? true
      : Array.isArray(requiredPermission)
        ? requiredPermission.length === 0 || canAny(requiredPermission)
        : can(requiredPermission);

  // Redireciona quando o Dashboard raiz é inacessível — evita loop
  // redirecionando se a rota padrão também for `/restaurante/admin`.
  useEffect(() => {
    if (
      isAdminRoot &&
      user &&
      !allowed &&
      defaultRoute !== "/restaurante/admin"
    ) {
      router.replace(defaultRoute);
    }
  }, [isAdminRoot, user, allowed, defaultRoute, router]);

  // Sem permissão mapeada → libera
  if (requiredPermission === null) return <>{children}</>;

  // Array vazio → explicitamente liberado para todos
  if (Array.isArray(requiredPermission) && requiredPermission.length === 0) {
    return <>{children}</>;
  }

  // Se não há usuário ativo (ainda carregando/sem login), deixa passar —
  // o layout do app já tem sua própria camada de auth (Firebase/middleware).
  // O guard só age quando temos um LoggedUser e ele não tem acesso.
  if (!user) return <>{children}</>;

  // Dashboard raiz sem permissão: mostra placeholder vazio enquanto o
  // `useEffect` acima faz o `router.replace` — evita flash de "Acesso
  // restrito".
  if (isAdminRoot && !allowed) {
    return null;
  }

  return (
    <PermissionGuard permission={requiredPermission}>{children}</PermissionGuard>
  );
}
