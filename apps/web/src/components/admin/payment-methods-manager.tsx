"use client";

import { useState } from "react";
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import { type PaymentMethodConfig } from "@matrix-food/utils";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  value: PaymentMethodConfig[];
  onChange: (next: PaymentMethodConfig[]) => void;
}

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function reindex(list: PaymentMethodConfig[]): PaymentMethodConfig[] {
  return list.map((m, i) => ({ ...m, order: i }));
}

export function PaymentMethodsManager({ value, onChange }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sorted = [...value].sort((a, b) => a.order - b.order);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((m) => m.id === active.id);
    const newIndex = sorted.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(reindex(arrayMove(sorted, oldIndex, newIndex)));
  }

  function handleToggle(id: string) {
    onChange(value.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)));
  }

  function handleRemove(id: string) {
    if (!confirm("Remover esta forma de pagamento? Pedidos antigos não serão afetados.")) return;
    onChange(reindex(value.filter((m) => m.id !== id)));
  }

  function handleAdd() {
    const trimmed = newLabel.trim();
    if (!trimmed) {
      setError("Informe o nome da forma de pagamento.");
      return;
    }
    if (trimmed.length > 50) {
      setError("Nome muito longo (máx 50 caracteres).");
      return;
    }
    const exists = value.some((m) => m.label.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setError("Já existe uma forma de pagamento com esse nome.");
      return;
    }
    if (value.length >= 15) {
      setError("Limite máximo de 15 formas de pagamento atingido.");
      return;
    }
    const next: PaymentMethodConfig = {
      id: generateId(),
      code: "OTHER",
      label: trimmed,
      enabled: true,
      order: value.length,
      isCustom: true,
    };
    onChange([...value, next]);
    setNewLabel("");
    setError(null);
    setShowAdd(false);
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          {sorted.map((method) => (
            <SortableRow
              key={method.id}
              method={method}
              onToggle={() => handleToggle(method.id)}
              onRemove={() => handleRemove(method.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {sorted.length === 0 && (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Nenhuma forma de pagamento cadastrada. Adicione ao menos uma para receber pedidos.
        </p>
      )}

      {showAdd ? (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
          <label className="mb-1 block text-sm font-medium text-foreground">
            Nome da forma de pagamento
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => {
                setNewLabel(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              autoFocus
              placeholder="Ex: Vale-Refeição, Sodexo, Fiado"
              maxLength={50}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Adicionar
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setNewLabel("");
                setError(null);
              }}
              className="rounded-md border border-border px-3 py-2 text-muted-foreground hover:bg-muted"
              aria-label="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background py-2.5 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          Adicionar forma personalizada
        </button>
      )}
    </div>
  );
}

interface RowProps {
  method: PaymentMethodConfig;
  onToggle: () => void;
  onRemove: () => void;
}

function SortableRow({ method, onToggle, onRemove }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: method.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
        method.enabled
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-muted/30"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <label className="flex flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={method.enabled}
          onChange={onToggle}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        <span
          className={`text-sm font-medium ${
            method.enabled ? "text-foreground" : "text-muted-foreground line-through"
          }`}
        >
          {method.label}
        </span>
        {method.isCustom && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            personalizada
          </span>
        )}
      </label>

      <button
        type="button"
        onClick={onRemove}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
        aria-label="Remover forma de pagamento"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
