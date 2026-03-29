"use client";

import { useState } from "react";
import { MapPin, Clock, ChevronDown, ChevronUp } from "lucide-react";

interface Tenant {
  name: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  operatingHours: Record<
    string,
    { open: string; close: string; isOpen: boolean }
  > | null;
  deliverySettings: {
    minOrder: number;
    deliveryFee: number;
    estimatedMinutes: { min: number; max: number };
  } | null;
}

const DAY_LABELS: Record<string, string> = {
  sunday: "Domingo",
  monday: "Segunda",
  tuesday: "Terca",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sabado",
};

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function getCurrentDayKey(): string {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return days[new Date().getDay()] ?? "monday";
}

interface RestaurantHeaderProps {
  tenant: Tenant;
  isOpen?: boolean;
  nextOpenTime?: string | null;
}

export function RestaurantHeader({
  tenant,
  isOpen,
  nextOpenTime,
}: RestaurantHeaderProps) {
  const [showHours, setShowHours] = useState(false);
  const currentDay = getCurrentDayKey();

  // Se isOpen nao foi passado como prop, calcula internamente (compatibilidade)
  const open = isOpen ?? true;

  return (
    <div className="bg-white shadow-sm">
      {/* Banner */}
      {tenant.bannerUrl ? (
        <div className="h-40 w-full overflow-hidden">
          <img
            src={tenant.bannerUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="h-40 w-full bg-gradient-to-r from-primary/80 to-primary" />
      )}

      {/* Info */}
      <div className="mx-auto max-w-2xl px-4 pb-4">
        <div className="-mt-8 flex items-start gap-4">
          {/* Logo */}
          <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border-4 border-white bg-white shadow-md">
            {tenant.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/10 text-2xl font-bold text-primary">
                {tenant.name.charAt(0)}
              </div>
            )}
          </div>

          <div className="flex-1 pt-10">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{tenant.name}</h1>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  open
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {open ? "Aberto" : "Fechado"}
              </span>
            </div>

            {!open && nextOpenTime && (
              <p className="mt-0.5 text-xs text-red-500">{nextOpenTime}</p>
            )}

            {tenant.description && (
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                {tenant.description}
              </p>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {tenant.address && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {tenant.address}
              {tenant.city && `, ${tenant.city}`}
            </span>
          )}
          {tenant.deliverySettings && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {tenant.deliverySettings.estimatedMinutes.min}-
              {tenant.deliverySettings.estimatedMinutes.max} min
            </span>
          )}
        </div>

        {/* Horarios de funcionamento */}
        {tenant.operatingHours && (
          <div className="mt-3">
            <button
              onClick={() => setShowHours(!showHours)}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80"
            >
              <Clock className="h-3.5 w-3.5" />
              Horarios de funcionamento
              {showHours ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {showHours && (
              <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="space-y-1.5">
                  {DAY_ORDER.map((day) => {
                    const config = tenant.operatingHours?.[day];
                    const isToday = day === currentDay;
                    return (
                      <div
                        key={day}
                        className={`flex items-center justify-between text-sm ${
                          isToday ? "font-semibold text-primary" : "text-gray-600"
                        }`}
                      >
                        <span>{DAY_LABELS[day]}</span>
                        <span>
                          {config?.isOpen
                            ? `${config.open} - ${config.close}`
                            : "Fechado"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
