"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon issue in Next.js/webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface DeliveryArea {
  id: string;
  name: string;
  polygon: Array<{ lat: number; lng: number }>;
  deliveryFee: string;
  color: string;
  isActive: boolean;
}

interface DeliveryAreaMapProps {
  areas: DeliveryArea[];
  selectedAreaId: string | null;
  onAreaClick: (areaId: string) => void;
  drawingMode: boolean;
  onPolygonComplete: (points: Array<{ lat: number; lng: number }>) => void;
  center?: { lat: number; lng: number };
}

export function DeliveryAreaMap({
  areas,
  selectedAreaId,
  onAreaClick,
  drawingMode,
  onPolygonComplete,
  center,
}: DeliveryAreaMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonsRef = useRef<Map<string, L.Polygon>>(new Map());
  const drawingPointsRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const drawingMarkersRef = useRef<L.Marker[]>([]);
  const drawingPolylineRef = useRef<L.Polyline | null>(null);
  const drawingModeRef = useRef(drawingMode);

  // Keep drawingModeRef in sync
  useEffect(() => {
    drawingModeRef.current = drawingMode;
    if (!drawingMode) {
      clearDrawing();
    }
  }, [drawingMode]);

  const clearDrawing = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    drawingMarkersRef.current.forEach((m) => map.removeLayer(m));
    drawingMarkersRef.current = [];
    drawingPointsRef.current = [];

    if (drawingPolylineRef.current) {
      map.removeLayer(drawingPolylineRef.current);
      drawingPolylineRef.current = null;
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const defaultCenter = center ?? { lat: -15.7801, lng: -47.9292 };
    const map = L.map(mapContainerRef.current, {
      center: [defaultCenter.lat, defaultCenter.lng],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center]);

  // Handle drawing mode clicks
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const vertexIcon = L.divIcon({
      className: "drawing-vertex",
      html: '<div style="width:12px;height:12px;background:#7c3aed;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    function handleClick(e: L.LeafletMouseEvent) {
      if (!drawingModeRef.current) return;

      const point = { lat: e.latlng.lat, lng: e.latlng.lng };
      drawingPointsRef.current.push(point);

      // Add vertex marker
      const marker = L.marker([point.lat, point.lng], {
        icon: vertexIcon,
        interactive: false,
      }).addTo(map!);
      drawingMarkersRef.current.push(marker);

      // Update preview polyline
      updateDrawingPreview(map!);
    }

    function handleDblClick(e: L.LeafletMouseEvent) {
      if (!drawingModeRef.current) return;
      if (e.originalEvent) {
        L.DomEvent.stopPropagation(e.originalEvent);
        L.DomEvent.preventDefault(e.originalEvent);
      }

      const points = drawingPointsRef.current;
      if (points.length >= 3) {
        onPolygonComplete([...points]);
      }
      clearDrawing();
    }

    map.on("click", handleClick as L.LeafletEventHandlerFn);
    map.on("dblclick", handleDblClick as L.LeafletEventHandlerFn);

    return () => {
      map.off("click", handleClick as L.LeafletEventHandlerFn);
      map.off("dblclick", handleDblClick as L.LeafletEventHandlerFn);
    };
  }, [onPolygonComplete, clearDrawing]);

  function updateDrawingPreview(map: L.Map) {
    if (drawingPolylineRef.current) {
      map.removeLayer(drawingPolylineRef.current);
    }

    const points = drawingPointsRef.current;
    if (points.length < 2) return;

    const latlngs = points.map((p) => [p.lat, p.lng] as L.LatLngTuple);
    // Close the shape preview
    if (points.length >= 3) {
      latlngs.push(latlngs[0]!);
    }

    drawingPolylineRef.current = L.polyline(latlngs, {
      color: "#7c3aed",
      weight: 2,
      dashArray: "6, 8",
      opacity: 0.8,
    }).addTo(map);
  }

  // Render area polygons
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old polygons
    polygonsRef.current.forEach((p) => map.removeLayer(p));
    polygonsRef.current.clear();

    // Add new polygons
    areas.forEach((area) => {
      if (!area.polygon || area.polygon.length < 3) return;

      const latlngs = area.polygon.map(
        (p) => [p.lat, p.lng] as L.LatLngTuple,
      );
      const isSelected = area.id === selectedAreaId;

      const polygon = L.polygon(latlngs, {
        color: area.color || "#7c3aed",
        weight: isSelected ? 3 : 2,
        opacity: isSelected ? 1 : 0.7,
        fillColor: area.color || "#7c3aed",
        fillOpacity: isSelected ? 0.35 : area.isActive ? 0.2 : 0.08,
        dashArray: area.isActive ? undefined : "5, 5",
      }).addTo(map);

      const fee = parseFloat(area.deliveryFee || "0");
      const feeFormatted = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(fee);

      polygon.bindPopup(
        `<div style="text-align:center;">
          <strong>${area.name}</strong><br/>
          <span style="color:#666;">Taxa: ${feeFormatted}</span>
          ${!area.isActive ? '<br/><span style="color:#f59e0b;font-size:12px;">Inativa</span>' : ""}
        </div>`,
      );

      polygon.on("click", () => {
        if (!drawingModeRef.current) {
          onAreaClick(area.id);
        }
      });

      polygonsRef.current.set(area.id, polygon);
    });

    // Fit bounds if there are areas
    if (areas.length > 0) {
      const allPoints = areas.flatMap((a) =>
        (a.polygon || []).map((p) => [p.lat, p.lng] as L.LatLngTuple),
      );
      if (allPoints.length > 0) {
        map.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40] });
      }
    }
  }, [areas, selectedAreaId, onAreaClick]);

  // Update cursor style for drawing mode
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if (drawingMode) {
      container.style.cursor = "crosshair";
    } else {
      container.style.cursor = "";
    }
  }, [drawingMode]);

  return (
    <div
      ref={mapContainerRef}
      className="h-full w-full rounded-lg"
      style={{ minHeight: "300px" }}
    />
  );
}

export default DeliveryAreaMap;
