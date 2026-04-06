"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Save, Clock } from "lucide-react";
import { ShareLinkSection } from "@/components/customer/share-link-section";
import { ImageUploader } from "@/components/admin/image-uploader";

const DAYS_CONFIG = [
  { key: "monday", label: "Segunda-feira" },
  { key: "tuesday", label: "Terça-feira" },
  { key: "wednesday", label: "Quarta-feira" },
  { key: "thursday", label: "Quinta-feira" },
  { key: "friday", label: "Sexta-feira" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
] as const;

type DayHours = { open: string; close: string; isOpen: boolean };
type OperatingHoursState = Record<string, DayHours>;

const DEFAULT_HOURS: OperatingHoursState = Object.fromEntries(
  DAYS_CONFIG.map(({ key }) => [key, { open: "08:00", close: "22:00", isOpen: false }])
);

export default function ConfiguracoesPage() {
  const tenant = trpc.tenant.getById.useQuery();
  const utils = trpc.useUtils();
  const updateMutation = trpc.tenant.update.useMutation({
    onSuccess: () => utils.tenant.getById.invalidate(),
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [operatingHours, setOperatingHours] = useState<OperatingHoursState>(DEFAULT_HOURS);

  const updateDay = useCallback((day: string, field: keyof DayHours, value: string | boolean) => {
    setOperatingHours((prev) => ({
      ...prev,
      [day]: { ...prev[day]!, [field]: value },
    }));
  }, []);

  useEffect(() => {
    if (tenant.data) {
      setName(tenant.data.name);
      setDescription(tenant.data.description ?? "");
      setAddress(tenant.data.address ?? "");
      setCity(tenant.data.city ?? "");
      setState(tenant.data.state ?? "");
      setZipCode(tenant.data.zipCode ?? "");
      setPhone(tenant.data.phone ?? "");
      setWhatsapp(tenant.data.whatsapp ?? "");
      setEmail(tenant.data.email ?? "");
      setLogoUrl(tenant.data.logoUrl ?? null);
      setBannerUrl(tenant.data.bannerUrl ?? null);
      if (tenant.data.operatingHours) {
        setOperatingHours({ ...DEFAULT_HOURS, ...tenant.data.operatingHours });
      }
    }
  }, [tenant.data]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      name,
      description: description || undefined,
      logoUrl,
      bannerUrl,
      operatingHours,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      zipCode: zipCode || undefined,
      phone: phone || undefined,
      whatsapp: whatsapp || undefined,
      email: email || undefined,
    });
  }

  if (tenant.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
      <p className="mt-1 text-muted-foreground">
        Dados do seu restaurante
      </p>

      {/* Link do Cardapio / QR Code */}
      {tenant.data?.slug && (
        <div className="mt-6 max-w-2xl">
          <ShareLinkSection slug={tenant.data.slug} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-6">
        {/* Imagens */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Imagens
          </h2>
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Logo do Restaurante
              </label>
              <p className="mb-2 text-xs text-muted-foreground">
                Imagem quadrada, recomendado 400x400px
              </p>
              <ImageUploader
                value={logoUrl}
                onChange={setLogoUrl}
                folder="matrix-food/logos"
                aspectRatio={1}
                previewWidth={160}
                previewHeight={160}
                label="Enviar logo"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Imagem de Capa
              </label>
              <p className="mb-2 text-xs text-muted-foreground">
                Banner horizontal, recomendado 1200x400px
              </p>
              <ImageUploader
                value={bannerUrl}
                onChange={setBannerUrl}
                folder="matrix-food/banners"
                aspectRatio={3}
                previewWidth={400}
                previewHeight={133}
                placeholderClass="flex h-28 w-full max-w-sm flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                label="Enviar capa"
              />
            </div>
          </div>
        </section>

        {/* Info básica */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Informações Básicas
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground">
                Nome do Restaurante *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground">
                Descrição
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </section>

        {/* Contato */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Contato
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Telefone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(51) 99999-9999"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                WhatsApp
              </label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(51) 99999-9999"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </section>

        {/* Endereço */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Endereço
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground">
                Endereço
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Cidade
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  UF
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  CEP
                </label>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="00000-000"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Horários de Funcionamento */}
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Horários de Funcionamento
            </h2>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Configure os dias e horários em que seu restaurante aceita pedidos.
          </p>
          <div className="space-y-3">
            {DAYS_CONFIG.map(({ key, label }) => {
              const day = operatingHours[key]!;
              return (
                <div
                  key={key}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors ${
                    day.isOpen
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-muted/30"
                  }`}
                >
                  <label className="flex w-36 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={day.isOpen}
                      onChange={(e) => updateDay(key, "isOpen", e.target.checked)}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    <span
                      className={`text-sm font-medium ${
                        day.isOpen ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </label>
                  {day.isOpen ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={day.open}
                        onChange={(e) => updateDay(key, "open", e.target.value)}
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-sm text-muted-foreground">às</span>
                      <input
                        type="time"
                        value={day.close}
                        onChange={(e) => updateDay(key, "close", e.target.value)}
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Fechado</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <button
          type="submit"
          disabled={updateMutation.isPending || !name.trim()}
          className="flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Configurações
        </button>

        {updateMutation.isSuccess && (
          <p className="text-sm text-green-600">Configurações salvas!</p>
        )}
      </form>
    </div>
  );
}
