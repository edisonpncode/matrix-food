"use client";

import { usePathname } from "next/navigation";
import { usePermissions } from "@/lib/permissions";
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

  // Dashboard (root)
  { prefix: "/restaurante/admin/mini-max", permission: [] }, // liberado para todos (beta)

  // Nota: /restaurante/admin (dashboard raiz) não exige permissão,
  // pois precisamos ter uma rota de fallback para usuário sem dashboard.view ser redirecionado.
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
 */
export function RoutePermissionGuard({ children }: RoutePermissionGuardProps) {
  const pathname = usePathname();
  const { user } = usePermissions();

  const requiredPermission = matchPermission(pathname);

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

  return (
    <PermissionGuard permission={requiredPermission}>{children}</PermissionGuard>
  );
}
