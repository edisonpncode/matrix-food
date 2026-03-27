"use client";

import { useState, useEffect } from "react";
import { MapPin, CheckCircle, AlertTriangle, Loader2, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@matrix-food/utils";

interface AddressData {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  referencePoint?: string;
  lat?: number;
  lng?: number;
}

interface DeliveryAreaResult {
  id: string;
  name: string;
  deliveryFee: string;
  estimatedMinutes?: number | null;
  freeDeliveryAbove?: string | null;
}

interface AddressFormProps {
  onAddressConfirmed: (
    address: AddressData,
    deliveryArea: {
      id: string;
      name: string;
      deliveryFee: string;
      estimatedMinutes?: number | null;
    } | null,
    manualFee?: string
  ) => void;
  initialAddress?: AddressData | null;
}

export function AddressForm({ onAddressConfirmed, initialAddress }: AddressFormProps) {
  const [street, setStreet] = useState(initialAddress?.street ?? "");
  const [number, setNumber] = useState(initialAddress?.number ?? "");
  const [complement, setComplement] = useState(initialAddress?.complement ?? "");
  const [neighborhood, setNeighborhood] = useState(initialAddress?.neighborhood ?? "");
  const [city, setCity] = useState(initialAddress?.city ?? "");
  const [state, setState] = useState(initialAddress?.state ?? "");
  const [zipCode, setZipCode] = useState(initialAddress?.zipCode ?? "");
  const [referencePoint, setReferencePoint] = useState(initialAddress?.referencePoint ?? "");

  const [areaChecked, setAreaChecked] = useState(false);
  const [geocodedCoords, setGeocodedCoords] = useState<{ lat: number; lng: number } | null>(
    initialAddress?.lat && initialAddress?.lng
      ? { lat: initialAddress.lat, lng: initialAddress.lng }
      : null
  );
  const [deliveryArea, setDeliveryArea] = useState<DeliveryAreaResult | null>(null);
  const [outsideArea, setOutsideArea] = useState(false);
  const [manualFee, setManualFee] = useState("");

  // Geocode query
  const geocodeQuery = trpc.deliveryArea.geocodeAddress.useQuery(
    { street, number, city, state },
    { enabled: false }
  );

  // Check address query
  const checkQuery = trpc.deliveryArea.checkAddress.useQuery(
    { lat: geocodedCoords?.lat ?? 0, lng: geocodedCoords?.lng ?? 0 },
    { enabled: false }
  );

  // When initialAddress has coords, check area on mount
  useEffect(() => {
    if (initialAddress?.lat && initialAddress?.lng) {
      setGeocodedCoords({ lat: initialAddress.lat, lng: initialAddress.lng });
    }
  }, [initialAddress]);

  const canCheckArea = street.trim() && number.trim() && city.trim() && state.trim();
  const isChecking = geocodeQuery.isFetching || checkQuery.isFetching;

  const handleCheckArea = async () => {
    setAreaChecked(false);
    setDeliveryArea(null);
    setOutsideArea(false);
    setManualFee("");

    try {
      const geoResult = await geocodeQuery.refetch();
      if (geoResult.data) {
        const coords = { lat: geoResult.data.lat, lng: geoResult.data.lng };
        setGeocodedCoords(coords);

        // Now check the delivery area
        const areaResult = await checkQuery.refetch();
        setAreaChecked(true);

        if (areaResult.data) {
          setDeliveryArea(areaResult.data as DeliveryAreaResult);
          setOutsideArea(false);
        } else {
          setDeliveryArea(null);
          setOutsideArea(true);
        }
      } else {
        // Could not geocode
        setAreaChecked(true);
        setOutsideArea(true);
        setGeocodedCoords(null);
      }
    } catch {
      setAreaChecked(true);
      setOutsideArea(true);
    }
  };

  const handleConfirm = () => {
    const address: AddressData = {
      street: street.trim(),
      number: number.trim(),
      complement: complement.trim() || undefined,
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim(),
      zipCode: zipCode.trim(),
      referencePoint: referencePoint.trim() || undefined,
      lat: geocodedCoords?.lat,
      lng: geocodedCoords?.lng,
    };

    if (deliveryArea) {
      onAddressConfirmed(
        address,
        {
          id: deliveryArea.id,
          name: deliveryArea.name,
          deliveryFee: deliveryArea.deliveryFee,
          estimatedMinutes: deliveryArea.estimatedMinutes,
        },
        undefined
      );
    } else {
      onAddressConfirmed(address, null, manualFee || undefined);
    }
  };

  const canConfirm =
    street.trim() &&
    number.trim() &&
    neighborhood.trim() &&
    city.trim() &&
    state.trim() &&
    areaChecked &&
    (deliveryArea || manualFee.trim());

  const inputClass =
    "w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Endereco de Entrega</h4>
      </div>

      {/* Street + Number row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Rua *
          </label>
          <input
            type="text"
            value={street}
            onChange={(e) => {
              setStreet(e.target.value);
              setAreaChecked(false);
            }}
            placeholder="Nome da rua"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Numero *
          </label>
          <input
            type="text"
            value={number}
            onChange={(e) => {
              setNumber(e.target.value);
              setAreaChecked(false);
            }}
            placeholder="123"
            className={inputClass}
          />
        </div>
      </div>

      {/* Complement + Neighborhood */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Complemento
          </label>
          <input
            type="text"
            value={complement}
            onChange={(e) => setComplement(e.target.value)}
            placeholder="Apto, bloco..."
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Bairro *
          </label>
          <input
            type="text"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            placeholder="Bairro"
            className={inputClass}
          />
        </div>
      </div>

      {/* City + State + CEP */}
      <div className="grid grid-cols-4 gap-2">
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Cidade *
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setAreaChecked(false);
            }}
            placeholder="Cidade"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Estado *
          </label>
          <input
            type="text"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setAreaChecked(false);
            }}
            placeholder="SP"
            maxLength={2}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            CEP
          </label>
          <input
            type="text"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            placeholder="00000-000"
            className={inputClass}
          />
        </div>
      </div>

      {/* Reference point */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Ponto de Referencia
        </label>
        <input
          type="text"
          value={referencePoint}
          onChange={(e) => setReferencePoint(e.target.value)}
          placeholder="Proximo ao mercado, portao azul..."
          className={inputClass}
        />
      </div>

      {/* Check area button */}
      {!areaChecked && (
        <button
          type="button"
          onClick={handleCheckArea}
          disabled={!canCheckArea || isChecking}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 py-2.5 text-sm font-medium text-primary hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50"
        >
          {isChecking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4" />
              Verificar Area de Entrega
            </>
          )}
        </button>
      )}

      {/* Area result: found */}
      {areaChecked && deliveryArea && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">
                Area: {deliveryArea.name}
              </p>
              <p className="text-sm text-green-700">
                Taxa: {formatCurrency(parseFloat(deliveryArea.deliveryFee))}
              </p>
              {deliveryArea.estimatedMinutes && (
                <p className="flex items-center gap-1 text-xs text-green-600">
                  <Clock className="h-3 w-3" />
                  Tempo estimado: {deliveryArea.estimatedMinutes} min
                </p>
              )}
              {deliveryArea.freeDeliveryAbove && (
                <p className="mt-1 text-xs text-green-600">
                  Frete gratis acima de{" "}
                  {formatCurrency(parseFloat(deliveryArea.freeDeliveryAbove))}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Area result: not found */}
      {areaChecked && outsideArea && (
        <div className="space-y-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
            <div>
              <p className="text-sm font-semibold text-yellow-800">
                Endereco fora da area de entrega
              </p>
              <p className="text-xs text-yellow-600">
                Informe a taxa de entrega manualmente ou recuse o pedido.
              </p>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-yellow-700">
              Taxa de entrega manual (R$)
            </label>
            <input
              type="number"
              value={manualFee}
              onChange={(e) => setManualFee(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-yellow-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      )}

      {/* Confirm button */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!canConfirm}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
      >
        Confirmar Endereco
      </button>
    </div>
  );
}
