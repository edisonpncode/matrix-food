"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Point {
  lat: number;
  lng: number;
  weight: number;
}

interface Props {
  points: Point[];
  height?: number;
}

export function DeliveryHeatMap({ points, height = 480 }: Props) {
  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Sem entregas com coordenadas no período.
      </div>
    );
  }

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const center: [number, number] = [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
  ];
  const maxWeight = Math.max(...points.map((p) => p.weight));

  function radiusFor(weight: number): number {
    const min = 6;
    const max = 28;
    if (maxWeight === 0) return min;
    return min + (max - min) * (weight / maxWeight);
  }

  function colorFor(weight: number): string {
    if (maxWeight === 0) return "#7c3aed";
    const intensity = weight / maxWeight;
    if (intensity > 0.75) return "#dc2626";
    if (intensity > 0.5) return "#f59e0b";
    if (intensity > 0.25) return "#eab308";
    return "#7c3aed";
  }

  return (
    <div style={{ height }} className="overflow-hidden rounded-lg border">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={radiusFor(p.weight)}
            pathOptions={{
              color: colorFor(p.weight),
              fillColor: colorFor(p.weight),
              fillOpacity: 0.5,
              weight: 1,
            }}
          >
            <Tooltip>
              {p.weight} pedido{p.weight === 1 ? "" : "s"}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
