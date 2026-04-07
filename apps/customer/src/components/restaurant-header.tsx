"use client";

import { MapPin, Clock } from "lucide-react";
import { isRestaurantOpen } from "@matrix-food/utils";
import { LoginButton } from "./auth/login-button";

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

export function RestaurantHeader({ tenant }: { tenant: Tenant }) {
  const open = tenant.operatingHours
    ? isRestaurantOpen(tenant.operatingHours)
    : true;

  return (
    <div className="bg-white shadow-sm">
      {/* Banner */}
      <div className="relative">
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
        <div className="absolute right-4 top-4 z-20">
          <LoginButton />
        </div>
      </div>

      {/* Info */}
      <div className="mx-auto max-w-2xl px-4 pb-4">
        <div className="flex items-start gap-4 -mt-8">
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

            {tenant.description && (
              <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
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
      </div>
    </div>
  );
}
