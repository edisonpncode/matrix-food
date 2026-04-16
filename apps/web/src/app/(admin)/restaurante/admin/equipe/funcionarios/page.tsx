"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Plus,
  Pencil,
  UserCheck,
  UserX,
  Loader2,
  Search,
  User,
  Phone,
  Mail,
  Hash,
  Shield,
  Camera,
  Truck,
  Briefcase,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { ImageUploader } from "@/components/admin/image-uploader";

export default function FuncionariosPage() {
  const utils = trpc.useUtils();
  const staffList = trpc.staff.list.useQuery();
  const userTypes = trpc.userType.list.useQuery();

  const createMutation = trpc.staff.create.useMutation({
    onSuccess: () => {
      utils.staff.list.invalidate();
      utils.userType.list.invalidate();
      setShowForm(false);
      resetForm();
    },
  });
  const updateMutation = trpc.staff.update.useMutation({
    onSuccess: () => {
      utils.staff.list.invalidate();
      utils.userType.list.invalidate();
      setEditingId(null);
      setShowForm(false);
      resetForm();
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"OWNER" | "MANAGER" | "CASHIER" | "DELIVERY">("CASHIER");
  const [userTypeId, setUserTypeId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const ROLE_OPTIONS = [
    { value: "MANAGER" as const, label: "Gerente" },
    { value: "CASHIER" as const, label: "Caixa / Atendente" },
    { value: "DELIVERY" as const, label: "Entregador (Motoboy)" },
  ];

  const ROLE_LABELS: Record<string, { label: string; color: string }> = {
    OWNER: { label: "Dono", color: "bg-amber-100 text-amber-700" },
    MANAGER: { label: "Gerente", color: "bg-blue-100 text-blue-700" },
    CASHIER: { label: "Caixa", color: "bg-green-100 text-green-700" },
    DELIVERY: { label: "Entregador", color: "bg-purple-100 text-purple-700" },
  };

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setRole("CASHIER");
    setUserTypeId(null);
    setPhotoUrl(null);
    setPin("");
    setPassword("");
    setShowPassword(false);
  }

  // Indicador de força da senha (0 fraca, 1 média, 2 forte)
  function getPasswordStrength(pwd: string): 0 | 1 | 2 | 3 {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return Math.min(score, 3) as 0 | 1 | 2 | 3;
  }

  const passwordStrength = getPasswordStrength(password);
  const passwordValid = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

  // Dono do negócio sempre tem acesso total — não pode ter Função nem
  // Tipo de Usuário alterados. Detecta se o staff em edição é OWNER.
  const editingOwner = editingId !== null && role === "OWNER";
  const ownerUserTypeName =
    userTypes.data?.find((ut) => ut.id === userTypeId)?.name ?? null;

  function startEdit(staff: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
    userTypeId: string | null;
    photoUrl: string | null;
    pin: string | null;
  }) {
    setEditingId(staff.id);
    setName(staff.name);
    setEmail(staff.email ?? "");
    setPhone(staff.phone ?? "");
    setRole(staff.role as "OWNER" | "MANAGER" | "CASHIER" | "DELIVERY");
    setUserTypeId(staff.userTypeId);
    setPhotoUrl(staff.photoUrl);
    setPin(staff.pin ?? "");
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      // Se editando o dono, não envia `role`/`userTypeId` (sempre OWNER +
      // perfil original). O backend também bloqueia via guarda defensiva.
      const isOwnerEdit = role === "OWNER";
      updateMutation.mutate({
        id: editingId,
        name,
        email: email || null,
        phone: phone || null,
        ...(isOwnerEdit ? {} : { role, userTypeId }),
        photoUrl,
        pin: pin || null,
        ...(password ? { password } : {}),
      });
    } else {
      createMutation.mutate({
        name,
        email,
        phone: phone || undefined,
        role,
        userTypeId,
        photoUrl,
        pin,
        password,
      });
    }
  }

  function handleToggleActive(id: string, isActive: boolean, staffName: string) {
    const action = isActive ? "desativar" : "reativar";
    if (confirm(`Tem certeza que deseja ${action} "${staffName}"?`)) {
      updateMutation.mutate({ id, isActive: !isActive });
    }
  }

  const filteredStaff = staffList.data?.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.includes(search)
  );

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Funcionários</h1>
          <p className="mt-1 text-muted-foreground">
            Gerencie sua equipe e atribua perfis de acesso
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
          Novo Funcionário
        </button>
      </div>

      {/* Busca */}
      <div className="mt-4 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, email ou telefone..."
          className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Formulário */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-lg border border-border bg-card p-4"
        >
          <h3 className="mb-3 font-semibold text-foreground">
            {editingId ? "Editar Funcionário" : "Novo Funcionário"}
          </h3>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Nome */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Nome *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  required
                  className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                  className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Telefone */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Telefone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Função */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Função *
              </label>
              {editingOwner ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span className="flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <Briefcase className="h-3 w-3" />
                    Dono
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Proprietário do negócio — não pode ser alterado.
                  </span>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as "MANAGER" | "CASHIER" | "DELIVERY")}
                      className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Entregadores aparecerão como opção ao despachar pedidos de tele entrega.
                  </p>
                </>
              )}
            </div>

            {/* Tipo de Usuário */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Tipo de Usuário (Perfil de Acesso)
              </label>
              {editingOwner ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <Shield className="h-3 w-3" />
                    {ownerUserTypeName ?? "Proprietário"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Acesso total — bloqueado por segurança.
                  </span>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      value={userTypeId ?? ""}
                      onChange={(e) =>
                        setUserTypeId(e.target.value || null)
                      }
                      className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Selecionar tipo...</option>
                      {userTypes.data
                        ?.filter((ut) => ut.isActive)
                        .map((ut) => (
                          <option key={ut.id} value={ut.id}>
                            {ut.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  {userTypes.data?.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      Crie um tipo de usuário primeiro em "Tipos de Usuário".
                    </p>
                  )}
                </>
              )}
            </div>

            {/* PIN (troca rápida) */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                PIN (troca rápida) *
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setPin(val);
                  }}
                  placeholder="4 a 6 dígitos"
                  maxLength={6}
                  required
                  className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Usado para trocar de operador rapidamente no POS/Admin.
              </p>
            </div>

            {/* Senha forte (login inicial) */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Senha {editingId ? "(opcional — só para alterar)" : "*"}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingId ? "Deixe em branco para manter" : "Mínimo 8 caracteres"}
                  autoComplete="new-password"
                  required={!editingId}
                  minLength={editingId && !password ? 0 : 8}
                  className="w-full rounded-md border border-input bg-background pl-10 pr-10 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && (
                <>
                  <div className="mt-1.5 flex gap-1">
                    {[1, 2, 3].map((bar) => (
                      <div
                        key={bar}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          passwordStrength >= bar
                            ? passwordStrength === 1
                              ? "bg-red-500"
                              : passwordStrength === 2
                                ? "bg-amber-500"
                                : "bg-green-500"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`mt-1 text-xs ${passwordValid ? "text-green-600" : "text-muted-foreground"}`}>
                    {passwordValid
                      ? "Senha válida"
                      : "A senha deve ter letras e números (mín. 8 caracteres)"}
                  </p>
                </>
              )}
              {!password && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Usada para login inicial (email + senha).
                </p>
              )}
            </div>

            {/* Foto */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
                <Camera className="h-4 w-4" />
                Foto do Funcionário (opcional)
              </label>
              <ImageUploader
                value={photoUrl}
                onChange={setPhotoUrl}
                folder="matrix-food/staff"
              />
            </div>
          </div>

          {/* Erros */}
          {(createMutation.error || updateMutation.error) && (
            <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {createMutation.error?.message || updateMutation.error?.message}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={
                isLoading ||
                !name.trim() ||
                !email.trim() ||
                (!editingId && pin.length < 4) ||
                (!editingId && !passwordValid) ||
                !!(editingId && password && !passwordValid)
              }
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
        {staffList.isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {filteredStaff?.length === 0 && !staffList.isLoading && (
          <div className="rounded-lg border border-dashed border-border py-12 text-center">
            <User className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">
              {search
                ? "Nenhum funcionário encontrado com essa busca."
                : "Nenhum funcionário cadastrado ainda."}
            </p>
          </div>
        )}

        {filteredStaff?.map((staff) => (
          <div
            key={staff.id}
            className={`flex items-center gap-4 rounded-lg border border-border bg-card p-4 ${
              !staff.isActive ? "opacity-60" : ""
            }`}
          >
            {/* Avatar */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
              {staff.photoUrl ? (
                <img
                  src={staff.photoUrl}
                  alt={staff.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-6 w-6 text-primary" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-foreground truncate">
                  {staff.name}
                </h3>
                {/* Role badge */}
                {ROLE_LABELS[staff.role] && (
                  <span className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${ROLE_LABELS[staff.role]!.color}`}>
                    {staff.role === "DELIVERY" ? <Truck className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                    {ROLE_LABELS[staff.role]!.label}
                  </span>
                )}
                {staff.userTypeName && (
                  <span className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <Shield className="h-3 w-3" />
                    {staff.userTypeName}
                  </span>
                )}
                {!staff.isActive && (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Inativo
                  </span>
                )}
                {staff.pin && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    PIN
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                {staff.email && (
                  <span className="flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3" />
                    {staff.email}
                  </span>
                )}
                {staff.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {staff.phone}
                  </span>
                )}
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-1">
              {staff.role === "OWNER" ? (
                <span
                  className="flex items-center justify-center rounded-md p-2 text-muted-foreground/60"
                  title="Dono — não pode ser desativado"
                >
                  <Lock className="h-4 w-4" />
                </span>
              ) : (
                <button
                  onClick={() => handleToggleActive(staff.id, staff.isActive, staff.name)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title={staff.isActive ? "Desativar" : "Reativar"}
                >
                  {staff.isActive ? (
                    <UserCheck className="h-4 w-4 text-green-600" />
                  ) : (
                    <UserX className="h-4 w-4 text-red-500" />
                  )}
                </button>
              )}
              <button
                onClick={() =>
                  startEdit({
                    id: staff.id,
                    name: staff.name,
                    email: staff.email,
                    phone: staff.phone,
                    role: staff.role,
                    userTypeId: staff.userTypeId,
                    photoUrl: staff.photoUrl,
                    pin: staff.pin,
                  })
                }
                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
