"use client";

import { useState, useEffect } from "react";
import { X, Clock, MapPin } from "lucide-react";

const PALETTE_COLORS = [
  "#7c3aed", // purple (primary)
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#ec4899", // pink
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
];

interface DeliveryAreaFormProps {
  area?: {
    id: string;
    name: string;
    deliveryFee: string;
    estimatedMinutes: number | null;
    freeDeliveryAbove: string | null;
    schedule: {
      enabled: boolean;
      days: number[];
      startTime: string;
      endTime: string;
    } | null;
    color: string;
  } | null;
  polygon: Array<{ lat: number; lng: number }> | null;
  onSave: (data: {
    name: string;
    polygon?: Array<{ lat: number; lng: number }>;
    deliveryFee: string;
    estimatedMinutes?: number;
    freeDeliveryAbove?: string;
    schedule?: {
      enabled: boolean;
      days: number[];
      startTime: string;
      endTime: string;
    };
    color: string;
  }) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function DeliveryAreaForm({
  area,
  polygon,
  onSave,
  onCancel,
  isLoading,
}: DeliveryAreaFormProps) {
  const [name, setName] = useState(area?.name ?? "");
  const [deliveryFee, setDeliveryFee] = useState(area?.deliveryFee ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    area?.estimatedMinutes?.toString() ?? "",
  );
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState(
    area?.freeDeliveryAbove ?? "",
  );
  const [color, setColor] = useState(area?.color ?? PALETTE_COLORS[0] ?? "#7c3aed");
  const [scheduleEnabled, setScheduleEnabled] = useState(
    area?.schedule?.enabled ?? false,
  );
  const [scheduleDays, setScheduleDays] = useState<number[]>(
    area?.schedule?.days ?? [1, 2, 3, 4, 5],
  );
  const [startTime, setStartTime] = useState(
    area?.schedule?.startTime ?? "08:00",
  );
  const [endTime, setEndTime] = useState(area?.schedule?.endTime ?? "22:00");

  useEffect(() => {
    if (area) {
      setName(area.name);
      setDeliveryFee(area.deliveryFee);
      setEstimatedMinutes(area.estimatedMinutes?.toString() ?? "");
      setFreeDeliveryAbove(area.freeDeliveryAbove ?? "");
      setColor(area.color || PALETTE_COLORS[0] || "#3b82f6");
      setScheduleEnabled(area.schedule?.enabled ?? false);
      setScheduleDays(area.schedule?.days ?? [1, 2, 3, 4, 5]);
      setStartTime(area.schedule?.startTime ?? "08:00");
      setEndTime(area.schedule?.endTime ?? "22:00");
    }
  }, [area]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const data: Parameters<typeof onSave>[0] = {
      name: name.trim(),
      deliveryFee,
      color,
    };

    if (polygon && polygon.length >= 3) {
      data.polygon = polygon;
    }

    if (estimatedMinutes) {
      data.estimatedMinutes = parseInt(estimatedMinutes, 10);
    }

    if (freeDeliveryAbove) {
      data.freeDeliveryAbove = freeDeliveryAbove;
    }

    if (scheduleEnabled) {
      data.schedule = {
        enabled: true,
        days: scheduleDays,
        startTime,
        endTime,
      };
    }

    onSave(data);
  }

  function toggleDay(day: number) {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  const isEditing = !!area;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Editar Area" : "Nova Area de Entrega"}
          </h2>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Polygon info */}
          {polygon && polygon.length >= 3 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>Poligono com {polygon.length} pontos definido</span>
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Nome da area <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Centro, Zona Sul, Ate 5km..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          {/* Taxa de entrega */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Taxa de entrega (R$) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          {/* Tempo estimado */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Tempo estimado (minutos)
            </label>
            <input
              type="number"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder="Ex: 30"
              min="1"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Frete gratis acima de */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Frete gratis acima de (R$)
            </label>
            <input
              type="number"
              value={freeDeliveryAbove}
              onChange={(e) => setFreeDeliveryAbove(e.target.value)}
              placeholder="Ex: 50.00"
              step="0.01"
              min="0"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Cor no mapa */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Cor no mapa
            </label>
            <div className="flex gap-2 flex-wrap">
              {PALETTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "#1f2937" : "transparent",
                    boxShadow:
                      color === c ? "0 0 0 2px white, 0 0 0 4px " + c : "none",
                  }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Restricao de horario */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScheduleEnabled(!scheduleEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  scheduleEnabled ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    scheduleEnabled ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Restricao de horario
              </span>
            </div>

            {scheduleEnabled && (
              <div className="space-y-3 pl-2 border-l-2 border-primary/20 ml-2">
                {/* Days */}
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">
                    Dias da semana
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                          scheduleDays.includes(day.value)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border hover:bg-muted"
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time range */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1">
                      Inicio
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1">
                      Fim
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim() || !deliveryFee}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Salvando..." : isEditing ? "Salvar" : "Criar Area"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
