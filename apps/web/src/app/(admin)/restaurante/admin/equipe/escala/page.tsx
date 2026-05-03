"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Plus,
  Trash2,
  X,
  CalendarOff,
  CalendarDays,
  Clock,
  AlertCircle,
} from "lucide-react";

const DAYS = [
  { idx: 0, short: "Dom", long: "Domingo" },
  { idx: 1, short: "Seg", long: "Segunda" },
  { idx: 2, short: "Ter", long: "Terça" },
  { idx: 3, short: "Qua", long: "Quarta" },
  { idx: 4, short: "Qui", long: "Quinta" },
  { idx: 5, short: "Sex", long: "Sexta" },
  { idx: 6, short: "Sáb", long: "Sábado" },
] as const;

type ShiftDraft = {
  startTime: string;
  endTime: string;
  notes: string | null;
};

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function dateRangeCoversDay(startDate: string, endDate: string, dayOfWeek: number): boolean {
  // Verifica se o intervalo [startDate, endDate] contém algum dia da semana específico
  // dentro dos próximos 7 dias a partir de hoje (visualização semanal corrente).
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 6);

  const rangeStart = start > today ? start : today;
  const rangeEnd = end < weekEnd ? end : weekEnd;
  if (rangeStart > rangeEnd) return false;

  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    if (cursor.getDay() === dayOfWeek) return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

export default function EscalaPage() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"escala" | "folgas">("escala");

  const staffQuery = trpc.staff.list.useQuery();
  const shiftsQuery = trpc.staffSchedule.listShifts.useQuery();
  const timeOffQuery = trpc.staffSchedule.listTimeOff.useQuery();

  const activeStaff = useMemo(
    () => (staffQuery.data ?? []).filter((s) => s.isActive),
    [staffQuery.data]
  );

  // Indexa shifts por (userId, dayOfWeek)
  const shiftsByCell = useMemo(() => {
    const map = new Map<string, { id: string; startTime: string; endTime: string; notes: string | null }[]>();
    for (const s of shiftsQuery.data ?? []) {
      const key = `${s.tenantUserId}_${s.dayOfWeek}`;
      const list = map.get(key) ?? [];
      list.push({ id: s.id, startTime: s.startTime, endTime: s.endTime, notes: s.notes });
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
    }
    return map;
  }, [shiftsQuery.data]);

  // Indexa folgas/férias por userId
  const timeOffByUser = useMemo(() => {
    const map = new Map<string, { id: string; type: "FOLGA" | "FERIAS"; startDate: string; endDate: string }[]>();
    for (const t of timeOffQuery.data ?? []) {
      const list = map.get(t.tenantUserId) ?? [];
      list.push({ id: t.id, type: t.type, startDate: t.startDate, endDate: t.endDate });
      map.set(t.tenantUserId, list);
    }
    return map;
  }, [timeOffQuery.data]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Escala de Funcionários</h1>
          <p className="text-sm text-muted-foreground">
            Defina os horários semanais e cadastre folgas/férias da equipe.
          </p>
        </div>
      </div>

      {/* Sub-tabs (escala vs folgas) */}
      <div className="mb-4 inline-flex rounded-lg border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setTab("escala")}
          className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition ${
            tab === "escala"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          Escala semanal
        </button>
        <button
          type="button"
          onClick={() => setTab("folgas")}
          className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition ${
            tab === "folgas"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarOff className="h-4 w-4" />
          Folgas e férias
        </button>
      </div>

      {tab === "escala" ? (
        <ScheduleGrid
          activeStaff={activeStaff}
          isLoading={staffQuery.isLoading || shiftsQuery.isLoading}
          shiftsByCell={shiftsByCell}
          timeOffByUser={timeOffByUser}
          onSaved={() => {
            utils.staffSchedule.listShifts.invalidate();
          }}
        />
      ) : (
        <TimeOffPanel
          activeStaff={activeStaff}
          timeOff={timeOffQuery.data ?? []}
          isLoading={timeOffQuery.isLoading}
          onChanged={() => {
            utils.staffSchedule.listTimeOff.invalidate();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// GRADE SEMANAL
// ============================================================

type StaffItem = { id: string; name: string; isActive: boolean };

function ScheduleGrid({
  activeStaff,
  isLoading,
  shiftsByCell,
  timeOffByUser,
  onSaved,
}: {
  activeStaff: StaffItem[];
  isLoading: boolean;
  shiftsByCell: Map<string, { id: string; startTime: string; endTime: string; notes: string | null }[]>;
  timeOffByUser: Map<string, { id: string; type: "FOLGA" | "FERIAS"; startDate: string; endDate: string }[]>;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<{ user: StaffItem; dayOfWeek: number } | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activeStaff.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum funcionário ativo. Cadastre funcionários na aba <strong>Funcionários</strong> antes
          de definir a escala.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="sticky left-0 z-10 min-w-[180px] bg-muted/40 p-3 text-left font-semibold text-foreground">
                Funcionário
              </th>
              {DAYS.map((d) => (
                <th
                  key={d.idx}
                  className="min-w-[110px] p-3 text-center font-semibold text-foreground"
                  title={d.long}
                >
                  {d.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeStaff.map((user) => {
              const userTimeOff = timeOffByUser.get(user.id) ?? [];
              return (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 bg-card p-3 font-medium text-foreground">
                    {user.name}
                  </td>
                  {DAYS.map((d) => {
                    const cellShifts = shiftsByCell.get(`${user.id}_${d.idx}`) ?? [];
                    const offThisDay = userTimeOff.find((t) =>
                      dateRangeCoversDay(t.startDate, t.endDate, d.idx)
                    );
                    return (
                      <td
                        key={d.idx}
                        className="border-l border-border align-top p-1"
                      >
                        <button
                          type="button"
                          onClick={() => setEditing({ user, dayOfWeek: d.idx })}
                          className="flex min-h-[60px] w-full flex-col gap-1 rounded p-1.5 text-left transition hover:bg-muted/50"
                        >
                          {offThisDay && (
                            <span
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                offThisDay.type === "FERIAS"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {offThisDay.type === "FERIAS" ? "Férias" : "Folga"}
                            </span>
                          )}
                          {cellShifts.length === 0 && !offThisDay && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {cellShifts.map((s) => (
                            <span
                              key={s.id}
                              className="inline-flex items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 text-[11px] font-medium text-purple-800"
                            >
                              <Clock className="h-3 w-3" />
                              {s.startTime}–{s.endTime}
                            </span>
                          ))}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Clique em qualquer célula para editar os turnos do funcionário naquele dia.
      </p>

      {editing && (
        <EditShiftsModal
          user={editing.user}
          dayOfWeek={editing.dayOfWeek}
          existingShifts={shiftsByCell.get(`${editing.user.id}_${editing.dayOfWeek}`) ?? []}
          allShiftsForUser={Array.from(shiftsByCell.entries())
            .filter(([k]) => k.startsWith(`${editing.user.id}_`))
            .flatMap(([k, list]) =>
              list.map((s) => ({
                dayOfWeek: Number(k.split("_")[1]),
                startTime: s.startTime,
                endTime: s.endTime,
                notes: s.notes,
              }))
            )}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onSaved();
          }}
        />
      )}
    </>
  );
}

// ============================================================
// MODAL DE EDIÇÃO DE TURNOS DO DIA
// ============================================================

function EditShiftsModal({
  user,
  dayOfWeek,
  existingShifts,
  allShiftsForUser,
  onClose,
  onSaved,
}: {
  user: StaffItem;
  dayOfWeek: number;
  existingShifts: { id: string; startTime: string; endTime: string; notes: string | null }[];
  allShiftsForUser: { dayOfWeek: number; startTime: string; endTime: string; notes: string | null }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const dayLabel = DAYS.find((d) => d.idx === dayOfWeek)?.long ?? "";
  const [drafts, setDrafts] = useState<ShiftDraft[]>(
    existingShifts.length > 0
      ? existingShifts.map((s) => ({ startTime: s.startTime, endTime: s.endTime, notes: s.notes }))
      : []
  );

  const setShifts = trpc.staffSchedule.setUserShifts.useMutation({
    onSuccess: onSaved,
  });

  function addBlock() {
    setDrafts((d) => [...d, { startTime: "18:00", endTime: "23:00", notes: "" }]);
  }
  function removeBlock(i: number) {
    setDrafts((d) => d.filter((_, idx) => idx !== i));
  }
  function updateBlock(i: number, patch: Partial<ShiftDraft>) {
    setDrafts((d) => d.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  function handleSave() {
    // Combina turnos dos OUTROS dias (inalterados) + os deste dia editado
    const otherDays = allShiftsForUser.filter((s) => s.dayOfWeek !== dayOfWeek);
    const thisDay = drafts
      .filter((d) => d.startTime && d.endTime)
      .map((d) => ({
        dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
        notes: d.notes?.trim() ? d.notes.trim() : null,
      }));
    setShifts.mutate({
      tenantUserId: user.id,
      shifts: [...otherDays, ...thisDay],
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Turnos de {user.name}
            </h3>
            <p className="text-sm text-muted-foreground">{dayLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {drafts.length === 0 ? (
            <p className="rounded border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Sem turnos neste dia. Clique em &ldquo;Adicionar turno&rdquo; para criar.
            </p>
          ) : (
            drafts.map((d, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_2fr_auto] items-end gap-2 rounded border border-border bg-background p-3"
              >
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Início
                  </label>
                  <input
                    type="time"
                    value={d.startTime}
                    onChange={(e) => updateBlock(i, { startTime: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Fim
                  </label>
                  <input
                    type="time"
                    value={d.endTime}
                    onChange={(e) => updateBlock(i, { endTime: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Observação
                  </label>
                  <input
                    type="text"
                    value={d.notes ?? ""}
                    onChange={(e) => updateBlock(i, { notes: e.target.value })}
                    placeholder="Opcional"
                    maxLength={200}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeBlock(i)}
                  className="rounded p-2 text-red-600 hover:bg-red-50"
                  aria-label="Remover turno"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}

          <button
            type="button"
            onClick={addBlock}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" />
            Adicionar turno
          </button>

          {setShifts.error && (
            <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{setShifts.error.message}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={setShifts.isPending}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {setShifts.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FOLGAS E FÉRIAS
// ============================================================

function TimeOffPanel({
  activeStaff,
  timeOff,
  isLoading,
  onChanged,
}: {
  activeStaff: StaffItem[];
  timeOff: {
    id: string;
    tenantUserId: string;
    type: "FOLGA" | "FERIAS";
    startDate: string;
    endDate: string;
    reason: string | null;
    userName: string | null;
  }[];
  isLoading: boolean;
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [tenantUserId, setTenantUserId] = useState("");
  const [type, setType] = useState<"FOLGA" | "FERIAS">("FOLGA");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const createMutation = trpc.staffSchedule.createTimeOff.useMutation({
    onSuccess: () => {
      onChanged();
      setShowForm(false);
      setTenantUserId("");
      setType("FOLGA");
      setStartDate("");
      setEndDate("");
      setReason("");
    },
  });
  const deleteMutation = trpc.staffSchedule.deleteTimeOff.useMutation({
    onSuccess: onChanged,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      tenantUserId,
      type,
      startDate,
      endDate,
      reason: reason.trim() ? reason.trim() : null,
    });
  }

  function handleDelete(id: string) {
    if (confirm("Remover este registro de folga/férias?")) {
      deleteMutation.mutate({ timeOffId: id });
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Adicionar folga/férias
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-4 rounded-lg border border-border bg-card p-4"
        >
          <h3 className="mb-3 font-semibold text-foreground">Nova folga ou férias</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Funcionário *
              </label>
              <select
                value={tenantUserId}
                onChange={(e) => setTenantUserId(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Selecione…</option>
                {activeStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Tipo *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "FOLGA" | "FERIAS")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="FOLGA">Folga</option>
                <option value="FERIAS">Férias</option>
              </select>
            </div>
            <div className="lg:col-span-1">
              <label className="mb-1 block text-sm font-medium text-foreground">
                Motivo
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Opcional"
                maxLength={300}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Data inicial *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Data final *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {createMutation.error && (
            <div className="mt-3 flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{createMutation.error.message}</span>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : timeOff.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma folga ou férias cadastrada.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {timeOff.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
                    t.type === "FERIAS"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {t.type === "FERIAS" ? "Férias" : "Folga"}
                </span>
                <div>
                  <p className="font-medium text-foreground">{t.userName ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateBR(t.startDate)} até {formatDateBR(t.endDate)}
                    {t.reason ? ` · ${t.reason}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                disabled={deleteMutation.isPending}
                className="rounded p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
