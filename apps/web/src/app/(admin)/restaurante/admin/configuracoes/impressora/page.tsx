"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { ReceiptPreview } from "@/components/receipt/receipt-preview";
import { dispatchTestPrint } from "@/lib/print-dispatcher";
import type { PrinterInfo, PrintSettings } from "@/lib/print-dispatcher";
import type { ReceiptConfig, PaperWidth } from "@/components/receipt/receipt-types";
import {
  Loader2,
  Save,
  Plus,
  Printer,
  Trash2,
  TestTube,
  Pencil,
  Wifi,
  Monitor,
  X,
  Star,
} from "lucide-react";

const DEFAULT_SETTINGS: PrintSettings = {
  printers: [],
  autoPrint: {
    enabled: false,
    onNewOrder: false,
    onOrderConfirmed: false,
    copies: 1,
  },
  receiptTypes: {
    customer: true,
    kitchen: false,
    delivery: false,
  },
  receiptConfig: {
    headerText: "",
    footerText: "Obrigado pela preferencia!",
    showCustomerInfo: true,
    showDeliveryAddress: true,
    showItemNotes: true,
    showOrderNotes: true,
    showPaymentMethod: true,
    showTimestamp: true,
  },
};

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

// ============================================================
// TOGGLE COMPONENT
// ============================================================
function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <div>
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}

// ============================================================
// PRINTER MODAL
// ============================================================
function PrinterModal({
  printer,
  onSave,
  onClose,
}: {
  printer?: PrinterInfo;
  onSave: (printer: PrinterInfo) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(printer?.name ?? "");
  const [paperWidth, setPaperWidth] = useState<PaperWidth>(
    printer?.paperWidth ?? "80mm"
  );
  const [connectionMethod, setConnectionMethod] = useState<
    "BROWSER" | "NETWORK"
  >(printer?.connectionMethod ?? "BROWSER");
  const [ipAddress, setIpAddress] = useState(
    printer?.networkConfig?.ipAddress ?? ""
  );
  const [port, setPort] = useState(printer?.networkConfig?.port ?? 9100);
  const [isDefault, setIsDefault] = useState(printer?.isDefault ?? false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      id: printer?.id ?? generateId(),
      name: name.trim(),
      paperWidth,
      connectionMethod,
      networkConfig:
        connectionMethod === "NETWORK"
          ? { ipAddress: ipAddress.trim(), port }
          : undefined,
      isDefault,
      isActive: true,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            {printer ? "Editar Impressora" : "Adicionar Impressora"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Nome da Impressora *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ex: Impressora Balcao"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Largura do papel */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Largura do Papel
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["80mm", "58mm"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setPaperWidth(w)}
                  className={`rounded-lg border-2 p-3 text-center transition-colors ${
                    paperWidth === w
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <div className="text-sm font-semibold">{w}</div>
                  <div className="text-xs">
                    {w === "80mm" ? "Padrao" : "Compacta"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Metodo de conexao */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Como a impressora esta conectada?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConnectionMethod("BROWSER")}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-colors ${
                  connectionMethod === "BROWSER"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                <Monitor className="h-5 w-5" />
                <div className="text-xs font-semibold">USB</div>
                <div className="text-[10px]">No computador</div>
              </button>
              <button
                type="button"
                onClick={() => setConnectionMethod("NETWORK")}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-colors ${
                  connectionMethod === "NETWORK"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                <Wifi className="h-5 w-5" />
                <div className="text-xs font-semibold">Rede / Wi-Fi</div>
                <div className="text-[10px]">Tem um IP</div>
              </button>
            </div>
          </div>

          {/* Config de rede */}
          {connectionMethod === "NETWORK" && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Endereco IP *
                </label>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  required
                  placeholder="192.168.1.100"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Porta
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  min={1}
                  max={65535}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Default */}
          <Toggle
            checked={isDefault}
            onChange={setIsDefault}
            label="Definir como impressora padrao"
          />

          {/* Botoes */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function ImpressoraPage() {
  const { data: rawSettings, isLoading } =
    trpc.tenant.getPrinterSettings.useQuery();
  const { data: tenant } = trpc.tenant.getById.useQuery();
  const utils = trpc.useUtils();
  const updateMutation = trpc.tenant.updatePrinterSettings.useMutation({
    onSuccess: () => {
      utils.tenant.getPrinterSettings.invalidate();
    },
  });
  const testPrintMutation = trpc.print.testPrint.useMutation();

  // Local state
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);
  const [showModal, setShowModal] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterInfo | undefined>();
  const [saved, setSaved] = useState(false);

  // Sync from server
  useEffect(() => {
    if (rawSettings) {
      setSettings(rawSettings as PrintSettings);
    }
  }, [rawSettings]);

  const restaurantName = tenant?.name ?? "Meu Restaurante";

  // Helpers
  function updateConfig(partial: Partial<ReceiptConfig>) {
    setSettings((s) => ({
      ...s,
      receiptConfig: { ...s.receiptConfig, ...partial },
    }));
  }

  function handleSavePrinter(printer: PrinterInfo) {
    setSettings((s) => {
      const existing = s.printers.findIndex((p) => p.id === printer.id);
      let newPrinters: PrinterInfo[];

      if (existing >= 0) {
        newPrinters = [...s.printers];
        newPrinters[existing] = printer;
      } else {
        newPrinters = [...s.printers, printer];
      }

      // Se esta eh a default, tirar default das outras
      if (printer.isDefault) {
        newPrinters = newPrinters.map((p) =>
          p.id === printer.id ? p : { ...p, isDefault: false }
        );
      }

      // Se eh a unica, forcar como default
      if (newPrinters.length === 1) {
        newPrinters[0] = { ...newPrinters[0]!, isDefault: true };
      }

      return { ...s, printers: newPrinters };
    });
    setShowModal(false);
    setEditingPrinter(undefined);
  }

  function handleRemovePrinter(id: string) {
    setSettings((s) => {
      const newPrinters = s.printers.filter((p) => p.id !== id);
      // Se removeu a default, fazer a primeira ser default
      if (newPrinters.length > 0 && !newPrinters.some((p) => p.isDefault)) {
        newPrinters[0] = { ...newPrinters[0]!, isDefault: true };
      }
      return { ...s, printers: newPrinters };
    });
  }

  async function handleTestPrint(printer: PrinterInfo) {
    if (printer.connectionMethod === "NETWORK") {
      testPrintMutation.mutate({ printerId: printer.id });
    } else {
      const { printTestPage } = await import("@/lib/print");
      printTestPage(restaurantName, printer.paperWidth);
    }
  }

  function handleSave() {
    updateMutation.mutate(settings, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      },
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Impressora</h1>
      <p className="mt-1 text-muted-foreground">
        Configure suas impressoras e personalize seus recibos
      </p>

      <div className="mt-6 space-y-6 max-w-4xl">
        {/* =============================================== */}
        {/* SECAO 1: IMPRESSORAS CONFIGURADAS */}
        {/* =============================================== */}
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Impressoras Configuradas
            </h2>
            <button
              type="button"
              onClick={() => {
                setEditingPrinter(undefined);
                setShowModal(true);
              }}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </button>
          </div>

          {settings.printers.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Printer className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">
                Nenhuma impressora configurada
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Configure sua impressora termica para imprimir recibos
                automaticamente quando chegar um pedido.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingPrinter(undefined);
                  setShowModal(true);
                }}
                className="mt-4 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Printer className="h-4 w-4" />
                Configurar Primeira Impressora
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {settings.printers.map((printer) => (
                <div
                  key={printer.id}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    {printer.isDefault && (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {printer.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {printer.paperWidth}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {printer.connectionMethod === "BROWSER" ? (
                            <>
                              <Monitor className="h-2.5 w-2.5" />
                              USB
                            </>
                          ) : (
                            <>
                              <Wifi className="h-2.5 w-2.5" />
                              {printer.networkConfig?.ipAddress}
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPrinter(printer);
                        setShowModal(true);
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestPrint(printer)}
                      disabled={testPrintMutation.isPending}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Imprimir teste"
                    >
                      <TestTube className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemovePrinter(printer.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* =============================================== */}
        {/* SECAO 2: TIPOS DE RECIBO */}
        {/* =============================================== */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Tipos de Recibo
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Escolha quais tipos de recibo seu restaurante vai usar.
          </p>
          <div className="space-y-3">
            <Toggle
              checked={settings.receiptTypes.customer}
              onChange={(v) =>
                setSettings((s) => ({
                  ...s,
                  receiptTypes: { ...s.receiptTypes, customer: v },
                }))
              }
              label="Recibo do Cliente"
              description="Recibo completo com todos os detalhes do pedido, precos e totais"
            />
            <Toggle
              checked={settings.receiptTypes.kitchen}
              onChange={(v) =>
                setSettings((s) => ({
                  ...s,
                  receiptTypes: { ...s.receiptTypes, kitchen: v },
                }))
              }
              label="Ticket de Cozinha"
              description="Versao simplificada so com itens e observacoes, sem precos — para a cozinha preparar"
            />
            <Toggle
              checked={settings.receiptTypes.delivery}
              onChange={(v) =>
                setSettings((s) => ({
                  ...s,
                  receiptTypes: { ...s.receiptTypes, delivery: v },
                }))
              }
              label="Via de Entrega"
              description="Focado no endereco e itens do pedido — para o entregador"
            />
          </div>
        </section>

        {/* =============================================== */}
        {/* SECAO 3: IMPRESSAO AUTOMATICA */}
        {/* =============================================== */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Impressao Automatica
          </h2>
          <div className="space-y-3">
            <Toggle
              checked={settings.autoPrint.enabled}
              onChange={(v) =>
                setSettings((s) => ({
                  ...s,
                  autoPrint: { ...s.autoPrint, enabled: v },
                }))
              }
              label="Ativar impressao automatica"
              description="Imprime os recibos automaticamente sem precisar clicar"
            />

            {settings.autoPrint.enabled && (
              <div className="ml-8 space-y-3 pt-1 border-l-2 border-primary/20 pl-4">
                <Toggle
                  checked={settings.autoPrint.onNewOrder}
                  onChange={(v) =>
                    setSettings((s) => ({
                      ...s,
                      autoPrint: { ...s.autoPrint, onNewOrder: v },
                    }))
                  }
                  label="Imprimir ao receber novo pedido"
                  description="Quando um pedido novo chegar no sistema"
                />
                <Toggle
                  checked={settings.autoPrint.onOrderConfirmed}
                  onChange={(v) =>
                    setSettings((s) => ({
                      ...s,
                      autoPrint: { ...s.autoPrint, onOrderConfirmed: v },
                    }))
                  }
                  label="Imprimir ao confirmar pedido"
                  description="Quando voce confirmar um pedido"
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Numero de copias
                  </label>
                  <select
                    value={settings.autoPrint.copies}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        autoPrint: {
                          ...s.autoPrint,
                          copies: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* =============================================== */}
        {/* SECAO 4: PERSONALIZAR RECIBO */}
        {/* =============================================== */}
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Personalizar Recibo
          </h2>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Lado esquerdo: configuracoes */}
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Texto do Cabecalho
                </label>
                <textarea
                  value={settings.receiptConfig.headerText}
                  onChange={(e) => updateConfig({ headerText: e.target.value })}
                  rows={3}
                  placeholder={"CNPJ: 00.000.000/0001-00\nRua Exemplo, 123 - Centro"}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Aparece abaixo do nome do restaurante (CNPJ, endereco, etc.)
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Texto do Rodape
                </label>
                <textarea
                  value={settings.receiptConfig.footerText}
                  onChange={(e) => updateConfig({ footerText: e.target.value })}
                  rows={2}
                  placeholder={"Obrigado pela preferencia!\nWi-Fi: restaurante123"}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Aparece no final do recibo (agradecimento, Wi-Fi, etc.)
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <p className="text-sm font-medium text-foreground">
                  Mostrar no recibo:
                </p>
                <Toggle
                  checked={settings.receiptConfig.showCustomerInfo}
                  onChange={(v) => updateConfig({ showCustomerInfo: v })}
                  label="Dados do cliente"
                  description="Nome e telefone"
                />
                <Toggle
                  checked={settings.receiptConfig.showDeliveryAddress}
                  onChange={(v) => updateConfig({ showDeliveryAddress: v })}
                  label="Endereco de entrega"
                  description="Nos pedidos de entrega"
                />
                <Toggle
                  checked={settings.receiptConfig.showItemNotes}
                  onChange={(v) => updateConfig({ showItemNotes: v })}
                  label="Observacoes dos itens"
                  description="Ex: sem cebola, bem passado"
                />
                <Toggle
                  checked={settings.receiptConfig.showOrderNotes}
                  onChange={(v) => updateConfig({ showOrderNotes: v })}
                  label="Observacoes do pedido"
                />
                <Toggle
                  checked={settings.receiptConfig.showPaymentMethod}
                  onChange={(v) => updateConfig({ showPaymentMethod: v })}
                  label="Forma de pagamento"
                />
                <Toggle
                  checked={settings.receiptConfig.showTimestamp}
                  onChange={(v) => updateConfig({ showTimestamp: v })}
                  label="Horario do pedido"
                />
              </div>
            </div>

            {/* Lado direito: preview ao vivo */}
            <div>
              <p className="text-sm font-medium text-foreground mb-2">
                Preview do Recibo
              </p>
              <ReceiptPreview
                config={settings.receiptConfig}
                paperWidth={
                  settings.printers.find((p) => p.isDefault)?.paperWidth ??
                  settings.printers[0]?.paperWidth ??
                  "80mm"
                }
                restaurantName={restaurantName}
              />
              <button
                type="button"
                onClick={() => {
                  const printer = settings.printers.find(
                    (p) => p.isDefault && p.isActive
                  ) ?? settings.printers[0];
                  if (printer) {
                    handleTestPrint(printer);
                  } else {
                    // Impressao de teste sem impressora configurada (usa browser default 80mm)
                    import("@/lib/print").then(({ printTestPage }) => {
                      printTestPage(restaurantName, "80mm");
                    });
                  }
                }}
                className="mt-3 flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent w-full justify-center"
              >
                <Printer className="h-4 w-4" />
                Imprimir Teste
              </button>
            </div>
          </div>
        </section>

        {/* BOTAO SALVAR */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Configuracoes
          </button>
          {saved && (
            <p className="text-sm text-green-600">Configuracoes salvas!</p>
          )}
        </div>
      </div>

      {/* Modal de adicionar/editar impressora */}
      {showModal && (
        <PrinterModal
          printer={editingPrinter}
          onSave={handleSavePrinter}
          onClose={() => {
            setShowModal(false);
            setEditingPrinter(undefined);
          }}
        />
      )}
    </div>
  );
}
