"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  Loader2,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  ShoppingBag,
  DollarSign,
  Settings,
  Shield,
  LogIn,
  Hash,
  Package,
  Tag,
  FolderOpen,
} from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Login",
  LOGOUT: "Logout",
  ORDER_CREATED: "Pedido criado",
  ORDER_CONFIRMED: "Pedido confirmado",
  ORDER_CANCELLED: "Pedido cancelado",
  ORDER_STATUS_CHANGED: "Status do pedido alterado",
  CASH_OPENED: "Caixa aberto",
  CASH_CLOSED: "Caixa fechado",
  CASH_WITHDRAWAL: "Sangria de caixa",
  PRODUCT_CREATED: "Produto criado",
  PRODUCT_UPDATED: "Produto atualizado",
  PRODUCT_DELETED: "Produto excluído",
  CATEGORY_CREATED: "Categoria criada",
  CATEGORY_UPDATED: "Categoria atualizada",
  PROMOTION_CREATED: "Promoção criada",
  PROMOTION_UPDATED: "Promoção atualizada",
  SETTINGS_UPDATED: "Configurações atualizadas",
  STAFF_CREATED: "Funcionário adicionado",
  STAFF_UPDATED: "Funcionário atualizado",
  STAFF_DEACTIVATED: "Funcionário desativado",
  USER_TYPE_CREATED: "Tipo de usuário criado",
  USER_TYPE_UPDATED: "Tipo de usuário atualizado",
  USER_TYPE_DELETED: "Tipo de usuário excluído",
  PIN_SWITCH: "Troca de operador (PIN)",
};

const ACTION_ICONS: Record<string, typeof Activity> = {
  LOGIN: LogIn,
  LOGOUT: LogIn,
  ORDER_CREATED: ShoppingBag,
  ORDER_CONFIRMED: ShoppingBag,
  ORDER_CANCELLED: ShoppingBag,
  ORDER_STATUS_CHANGED: ShoppingBag,
  CASH_OPENED: DollarSign,
  CASH_CLOSED: DollarSign,
  CASH_WITHDRAWAL: DollarSign,
  PRODUCT_CREATED: Package,
  PRODUCT_UPDATED: Package,
  PRODUCT_DELETED: Package,
  CATEGORY_CREATED: FolderOpen,
  CATEGORY_UPDATED: FolderOpen,
  PROMOTION_CREATED: Tag,
  PROMOTION_UPDATED: Tag,
  SETTINGS_UPDATED: Settings,
  STAFF_CREATED: User,
  STAFF_UPDATED: User,
  STAFF_DEACTIVATED: User,
  USER_TYPE_CREATED: Shield,
  USER_TYPE_UPDATED: Shield,
  USER_TYPE_DELETED: Shield,
  PIN_SWITCH: Hash,
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "text-green-600 bg-green-100",
  LOGOUT: "text-gray-600 bg-gray-100",
  ORDER_CREATED: "text-blue-600 bg-blue-100",
  ORDER_CONFIRMED: "text-blue-600 bg-blue-100",
  ORDER_CANCELLED: "text-red-600 bg-red-100",
  ORDER_STATUS_CHANGED: "text-blue-600 bg-blue-100",
  CASH_OPENED: "text-green-600 bg-green-100",
  CASH_CLOSED: "text-amber-600 bg-amber-100",
  CASH_WITHDRAWAL: "text-red-600 bg-red-100",
  PRODUCT_CREATED: "text-purple-600 bg-purple-100",
  PRODUCT_UPDATED: "text-purple-600 bg-purple-100",
  PRODUCT_DELETED: "text-red-600 bg-red-100",
  CATEGORY_CREATED: "text-indigo-600 bg-indigo-100",
  CATEGORY_UPDATED: "text-indigo-600 bg-indigo-100",
  PROMOTION_CREATED: "text-orange-600 bg-orange-100",
  PROMOTION_UPDATED: "text-orange-600 bg-orange-100",
  SETTINGS_UPDATED: "text-gray-600 bg-gray-100",
  STAFF_CREATED: "text-teal-600 bg-teal-100",
  STAFF_UPDATED: "text-teal-600 bg-teal-100",
  STAFF_DEACTIVATED: "text-red-600 bg-red-100",
  USER_TYPE_CREATED: "text-violet-600 bg-violet-100",
  USER_TYPE_UPDATED: "text-violet-600 bg-violet-100",
  USER_TYPE_DELETED: "text-red-600 bg-red-100",
  PIN_SWITCH: "text-amber-600 bg-amber-100",
};

type ActionType =
  | "LOGIN"
  | "LOGOUT"
  | "ORDER_CREATED"
  | "ORDER_CONFIRMED"
  | "ORDER_CANCELLED"
  | "ORDER_STATUS_CHANGED"
  | "CASH_OPENED"
  | "CASH_CLOSED"
  | "CASH_WITHDRAWAL"
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "PRODUCT_DELETED"
  | "CATEGORY_CREATED"
  | "CATEGORY_UPDATED"
  | "PROMOTION_CREATED"
  | "PROMOTION_UPDATED"
  | "SETTINGS_UPDATED"
  | "STAFF_CREATED"
  | "STAFF_UPDATED"
  | "STAFF_DEACTIVATED"
  | "USER_TYPE_CREATED"
  | "USER_TYPE_UPDATED"
  | "USER_TYPE_DELETED"
  | "PIN_SWITCH";

const PAGE_SIZE = 30;

export default function LogAtividadesPage() {
  const [offset, setOffset] = useState(0);
  const [filterAction, setFilterAction] = useState<ActionType | "">("");
  const [filterUser, setFilterUser] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const staffForFilter = trpc.activityLog.getStaffForFilter.useQuery();

  const logs = trpc.activityLog.list.useQuery({
    limit: PAGE_SIZE,
    offset,
    action: filterAction || undefined,
    userId: filterUser || undefined,
  });

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(date));
  }

  function handleFilterChange() {
    setOffset(0);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Log de Atividades
          </h1>
          <p className="mt-1 text-muted-foreground">
            Acompanhe todas as ações realizadas no sistema
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
            showFilters || filterAction || filterUser
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-foreground hover:bg-accent"
          }`}
        >
          <Filter className="h-4 w-4" />
          Filtros
          {(filterAction || filterUser) && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white">
              {(filterAction ? 1 : 0) + (filterUser ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="mt-4 flex flex-wrap gap-4 rounded-lg border border-border bg-card p-4">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm font-medium text-foreground">
              Tipo de Ação
            </label>
            <select
              value={filterAction}
              onChange={(e) => {
                setFilterAction(e.target.value as ActionType | "");
                handleFilterChange();
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todas as ações</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm font-medium text-foreground">
              Funcionário
            </label>
            <select
              value={filterUser}
              onChange={(e) => {
                setFilterUser(e.target.value);
                handleFilterChange();
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos</option>
              {staffForFilter.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {(filterAction || filterUser) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilterAction("");
                  setFilterUser("");
                  setOffset(0);
                }}
                className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lista de logs */}
      <div className="mt-6">
        {logs.isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {logs.data?.length === 0 && !logs.isLoading && (
          <div className="rounded-lg border border-dashed border-border py-12 text-center">
            <Activity className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">
              Nenhuma atividade registrada ainda.
            </p>
          </div>
        )}

        <div className="space-y-1">
          {logs.data?.map((log) => {
            const IconComponent = ACTION_ICONS[log.action] ?? Activity;
            const colorClass =
              ACTION_COLORS[log.action] ?? "text-gray-600 bg-gray-100";

            return (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorClass}`}
                >
                  <IconComponent className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {log.userName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {log.description}
                  </p>
                </div>

                <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(log.createdAt)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Paginação */}
        {logs.data && logs.data.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Mostrando {offset + 1} a {offset + logs.data.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <button
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={logs.data.length < PAGE_SIZE}
                className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent disabled:opacity-50"
              >
                Próximo
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
