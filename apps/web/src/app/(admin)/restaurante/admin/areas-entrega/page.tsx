"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  AlertCircle,
  Loader2,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";
import { DeliveryAreaForm } from "@/components/admin/delivery-area-form";

// Dynamic import for map (no SSR - Leaflet requires window)
const DeliveryAreaMap = dynamic(
  () =>
    import("@/components/admin/delivery-area-map").then(
      (m) => m.DeliveryAreaMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-muted rounded-lg">
        <MapPin className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    ),
  },
);

export default function AreasEntregaPage() {
  const utils = trpc.useUtils();

  const areas = trpc.deliveryArea.list.useQuery();
  const createMutation = trpc.deliveryArea.create.useMutation({
    onSuccess: () => {
      utils.deliveryArea.list.invalidate();
      resetState();
    },
  });
  const updateMutation = trpc.deliveryArea.update.useMutation({
    onSuccess: () => {
      utils.deliveryArea.list.invalidate();
      resetState();
    },
  });
  const deleteMutation = trpc.deliveryArea.delete.useMutation({
    onSuccess: () => {
      utils.deliveryArea.list.invalidate();
    },
  });

  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawnPolygon, setDrawnPolygon] = useState<
    Array<{ lat: number; lng: number }> | null
  >(null);
  const [showForm, setShowForm] = useState(false);
  const [editingArea, setEditingArea] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function resetState() {
    setDrawingMode(false);
    setDrawnPolygon(null);
    setShowForm(false);
    setEditingArea(null);
    setDeleteConfirmId(null);
  }

  function handleStartDrawing() {
    setSelectedAreaId(null);
    setEditingArea(null);
    setDrawnPolygon(null);
    setDrawingMode(true);
  }

  const handlePolygonComplete = useCallback(
    (points: Array<{ lat: number; lng: number }>) => {
      setDrawnPolygon(points);
      setDrawingMode(false);
      setShowForm(true);
    },
    [],
  );

  function handleAreaClick(areaId: string) {
    setSelectedAreaId(areaId);
  }

  function handleEdit(areaId: string) {
    setEditingArea(areaId);
    setSelectedAreaId(areaId);
    setShowForm(true);
  }

  function handleDelete(areaId: string) {
    setDeleteConfirmId(areaId);
  }

  function confirmDelete() {
    if (deleteConfirmId) {
      deleteMutation.mutate({ id: deleteConfirmId });
      setDeleteConfirmId(null);
      if (selectedAreaId === deleteConfirmId) {
        setSelectedAreaId(null);
      }
    }
  }

  function handleSave(data: {
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
  }) {
    if (editingArea) {
      updateMutation.mutate({ id: editingArea, ...data });
    } else {
      if (!data.polygon || data.polygon.length < 3) return;
      createMutation.mutate({ ...data, polygon: data.polygon });
    }
  }

  const editingAreaData = editingArea
    ? areas.data?.find((a) => a.id === editingArea) ?? null
    : null;

  const areaList = areas.data ?? [];

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* Left Panel - Area List */}
      <div className="w-80 shrink-0 flex flex-col border-r bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h1 className="text-lg font-semibold">Areas de Entrega</h1>
          <button
            onClick={handleStartDrawing}
            disabled={drawingMode}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            title="Adicionar area"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Area cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {areas.isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {areas.isError && (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-red-500">
              <AlertCircle className="h-6 w-6" />
              <span>Erro ao carregar areas</span>
            </div>
          )}

          {!areas.isLoading && areaList.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <MapPin className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhuma area cadastrada
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Clique em + para desenhar sua primeira area de entrega no mapa
                </p>
              </div>
            </div>
          )}

          {areaList.map((area) => {
            const fee = parseFloat(area.deliveryFee || "0");
            const isSelected = area.id === selectedAreaId;

            return (
              <div
                key={area.id}
                onClick={() => handleAreaClick(area.id)}
                className={`rounded-lg border bg-card p-3 cursor-pointer transition-all hover:shadow-sm ${
                  isSelected
                    ? "ring-2 ring-primary/50 border-primary/30"
                    : "hover:border-foreground/20"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Color dot */}
                  <div
                    className="mt-1 h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: area.color || "#7c3aed" }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm truncate">
                        {area.name}
                      </span>
                      {!area.isActive && (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{formatCurrency(fee)}</span>
                      {area.estimatedMinutes && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {area.estimatedMinutes} min
                        </span>
                      )}
                    </div>

                    {area.freeDeliveryAbove && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Gratis acima de{" "}
                        {formatCurrency(parseFloat(area.freeDeliveryAbove))}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(area.id);
                      }}
                      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(area.id);
                      }}
                      className="p-1 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Panel - Map */}
      <div className="flex-1 flex flex-col relative">
        {/* Drawing mode instruction bar */}
        {drawingMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Clique no mapa para adicionar pontos. Duplo clique para finalizar.
            <button
              onClick={resetState}
              className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs hover:bg-white/30 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}

        <DeliveryAreaMap
          areas={areaList.map((a) => ({
            id: a.id,
            name: a.name,
            polygon: (a.polygon as Array<{ lat: number; lng: number }>) ?? [],
            deliveryFee: a.deliveryFee,
            color: a.color,
            isActive: a.isActive,
          }))}
          selectedAreaId={selectedAreaId}
          onAreaClick={handleAreaClick}
          drawingMode={drawingMode}
          onPolygonComplete={handlePolygonComplete}
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <DeliveryAreaForm
          area={
            editingAreaData
              ? {
                  id: editingAreaData.id,
                  name: editingAreaData.name,
                  deliveryFee: editingAreaData.deliveryFee,
                  estimatedMinutes: editingAreaData.estimatedMinutes,
                  freeDeliveryAbove: editingAreaData.freeDeliveryAbove,
                  schedule: editingAreaData.schedule as {
                    enabled: boolean;
                    days: number[];
                    startTime: string;
                    endTime: string;
                  } | null,
                  color: editingAreaData.color,
                }
              : null
          }
          polygon={drawnPolygon}
          onSave={handleSave}
          onCancel={resetState}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-lg shadow-xl w-full max-w-sm mx-4 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold">Excluir area?</h3>
                <p className="text-sm text-muted-foreground">
                  Esta acao nao pode ser desfeita.
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
