"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Plus,
  Pencil,
  Trash2,
  Shield,
  Users,
  Loader2,
  ChevronDown,
  ChevronRight,
  Check,
} from "lucide-react";

interface PermissionGroup {
  label: string;
  permissions: Record<string, string>;
}

export default function TiposUsuarioPage() {
  const utils = trpc.useUtils();
  const userTypes = trpc.userType.list.useQuery();
  const availablePermissions = trpc.userType.getAvailablePermissions.useQuery();

  const createMutation = trpc.userType.create.useMutation({
    onSuccess: () => {
      utils.userType.list.invalidate();
      setShowForm(false);
      resetForm();
    },
  });
  const updateMutation = trpc.userType.update.useMutation({
    onSuccess: () => {
      utils.userType.list.invalidate();
      setEditingId(null);
      setShowForm(false);
      resetForm();
    },
  });
  const deleteMutation = trpc.userType.delete.useMutation({
    onSuccess: () => {
      utils.userType.list.invalidate();
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  function resetForm() {
    setName("");
    setDescription("");
    setPermissions({});
    setExpandedGroups(new Set());
  }

  function startEdit(ut: {
    id: string;
    name: string;
    description: string | null;
    permissions: Record<string, boolean>;
  }) {
    setEditingId(ut.id);
    setName(ut.name);
    setDescription(ut.description ?? "");
    setPermissions(ut.permissions ?? {});
    setShowForm(true);
    // Expandir todos os grupos que têm permissões marcadas
    if (availablePermissions.data) {
      const groups = new Set<string>();
      for (const [groupKey, group] of Object.entries(availablePermissions.data)) {
        const typedGroup = group as PermissionGroup;
        const hasAny = Object.keys(typedGroup.permissions).some(
          (p) => ut.permissions?.[p]
        );
        if (hasAny) groups.add(groupKey);
      }
      setExpandedGroups(groups);
    }
  }

  function toggleGroup(groupKey: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  function togglePermission(permKey: string) {
    setPermissions((prev) => ({
      ...prev,
      [permKey]: !prev[permKey],
    }));
  }

  function toggleAllInGroup(group: PermissionGroup) {
    const allPerms = Object.keys(group.permissions);
    const allChecked = allPerms.every((p) => permissions[p]);
    setPermissions((prev) => {
      const next = { ...prev };
      allPerms.forEach((p) => {
        next[p] = !allChecked;
      });
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Filtrar apenas permissões que são true
    const cleanPermissions: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(permissions)) {
      if (value) cleanPermissions[key] = true;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name,
        description: description || null,
        permissions: cleanPermissions,
      });
    } else {
      createMutation.mutate({
        name,
        description: description || undefined,
        permissions: cleanPermissions,
      });
    }
  }

  function handleDelete(id: string, typeName: string) {
    if (
      confirm(
        `Tem certeza que deseja excluir o tipo "${typeName}"? Funcionários vinculados ficarão sem tipo.`
      )
    ) {
      deleteMutation.mutate({ id });
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const permCount = Object.values(permissions).filter(Boolean).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Tipos de Usuário
          </h1>
          <p className="mt-1 text-muted-foreground">
            Crie perfis de acesso com permissões específicas para cada função
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            resetForm();
          }}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo Tipo
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-lg border border-border bg-card p-4"
        >
          <h3 className="mb-3 font-semibold text-foreground">
            {editingId ? "Editar Tipo de Usuário" : "Novo Tipo de Usuário"}
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Nome do Tipo *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Gerente, Caixa, Atendente"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Descrição
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Acesso total ao sistema"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Permissões */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Permissões ({permCount} selecionadas)
              </label>
              <button
                type="button"
                onClick={() => {
                  if (availablePermissions.data) {
                    const allPerms: Record<string, boolean> = {};
                    Object.values(availablePermissions.data).forEach(
                      (group) => {
                        const typedGroup = group as PermissionGroup;
                        Object.keys(typedGroup.permissions).forEach((p) => {
                          allPerms[p] = permCount === 0 ? true : false;
                        });
                      }
                    );
                    setPermissions(allPerms);
                    if (permCount === 0) {
                      setExpandedGroups(
                        new Set(Object.keys(availablePermissions.data))
                      );
                    }
                  }
                }}
                className="text-xs text-primary hover:underline"
              >
                {permCount === 0 ? "Selecionar todas" : "Desmarcar todas"}
              </button>
            </div>

            <div className="space-y-1 rounded-md border border-border bg-background">
              {availablePermissions.data &&
                Object.entries(availablePermissions.data).map(
                  ([groupKey, group]) => {
                    const typedGroup = group as PermissionGroup;
                    const isExpanded = expandedGroups.has(groupKey);
                    const groupPerms = Object.keys(typedGroup.permissions);
                    const checkedCount = groupPerms.filter(
                      (p) => permissions[p]
                    ).length;
                    const allChecked = checkedCount === groupPerms.length;

                    return (
                      <div key={groupKey} className="border-b border-border last:border-b-0">
                        <button
                          type="button"
                          onClick={() => toggleGroup(groupKey)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/50"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <Shield className="h-4 w-4 text-primary" />
                          <span className="flex-1 text-sm font-medium text-foreground">
                            {typedGroup.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {checkedCount}/{groupPerms.length}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAllInGroup(typedGroup);
                            }}
                            className={`flex h-5 w-5 items-center justify-center rounded border ${
                              allChecked
                                ? "border-primary bg-primary text-white"
                                : "border-input bg-background"
                            }`}
                          >
                            {allChecked && <Check className="h-3 w-3" />}
                          </button>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border bg-accent/20 px-3 py-2 pl-12">
                            {Object.entries(typedGroup.permissions).map(
                              ([permKey, permLabel]) => (
                                <label
                                  key={permKey}
                                  className="flex cursor-pointer items-center gap-3 py-1.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => togglePermission(permKey)}
                                    className={`flex h-5 w-5 items-center justify-center rounded border ${
                                      permissions[permKey]
                                        ? "border-primary bg-primary text-white"
                                        : "border-input bg-background"
                                    }`}
                                  >
                                    {permissions[permKey] && (
                                      <Check className="h-3 w-3" />
                                    )}
                                  </button>
                                  <span className="text-sm text-foreground">
                                    {permLabel as string}
                                  </span>
                                </label>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Salvar" : "Criar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                resetForm();
              }}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista */}
      <div className="mt-6 space-y-2">
        {userTypes.isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {userTypes.data?.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-12 text-center">
            <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">
              Nenhum tipo de usuário criado ainda.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie tipos como "Gerente", "Caixa", "Atendente" com permissões
              específicas.
            </p>
          </div>
        )}

        {userTypes.data?.map((ut) => {
          const permCount = Object.values(
            (ut.permissions as Record<string, boolean>) ?? {}
          ).filter(Boolean).length;

          return (
            <div
              key={ut.id}
              className={`flex items-center gap-4 rounded-lg border border-border bg-card p-4 ${
                !ut.isActive ? "opacity-60" : ""
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-foreground">{ut.name}</h3>
                  {ut.isSystem && (
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Sistema
                    </span>
                  )}
                  {!ut.isActive && (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Inativo
                    </span>
                  )}
                </div>
                {ut.description && (
                  <p className="text-sm text-muted-foreground">
                    {ut.description}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    {permCount} permissão(ões)
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {ut.usersCount} funcionário(s)
                  </span>
                </div>
              </div>

              {!ut.isSystem && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      startEdit({
                        id: ut.id,
                        name: ut.name,
                        description: ut.description,
                        permissions: ut.permissions as Record<string, boolean>,
                      })
                    }
                    className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(ut.id, ut.name)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
