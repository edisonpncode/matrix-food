"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Loader2,
  CheckCircle,
  XCircle,
  HelpCircle,
  Zap,
  Hand,
} from "lucide-react";

// ============================================
// CONSTANTS
// ============================================

const PROVIDERS = [
  {
    id: "FOCUS_NFE" as const,
    name: "Focus NFe",
    description: "API mais popular e bem documentada do Brasil",
    fields: [{ key: "token", label: "Token da API", type: "password" }],
  },
  {
    id: "WEBMANIA" as const,
    name: "Webmania",
    description: "API completa com suporte a webhooks",
    fields: [
      { key: "accessToken", label: "Access Token", type: "password" },
      {
        key: "accessTokenSecret",
        label: "Access Token Secret",
        type: "password",
      },
    ],
  },
  {
    id: "NUVEM_FISCAL" as const,
    name: "Nuvem Fiscal",
    description: "API moderna com OAuth2",
    fields: [
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
  },
  {
    id: "SAFEWEB" as const,
    name: "SafeWeb",
    description: "Assinatura digital e notas fiscais",
    fields: [{ key: "token", label: "Token da API", type: "password" }],
  },
];

const REGIME_OPTIONS = [
  { value: 1, label: "Simples Nacional (MEI / ME / EPP)" },
  { value: 2, label: "Simples Nacional - Excesso de Sublimite" },
  { value: 3, label: "Lucro Presumido ou Lucro Real" },
];

const STEPS = [
  "Provedor",
  "Credenciais",
  "Empresa",
  "Endereço",
  "NFC-e",
  "Emissão",
];

// ============================================
// TOOLTIP
// ============================================

function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex ml-1 cursor-help">
      <HelpCircle className="h-4 w-4 text-muted-foreground/50" />
      <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-foreground p-2 text-xs text-background shadow-lg z-50">
        {text}
      </span>
    </span>
  );
}

// ============================================
// PAGE
// ============================================

export default function FiscalConfigPage() {
  const router = useRouter();
  const config = trpc.fiscal.getConfig.useQuery();
  const saveMutation = trpc.fiscal.saveConfig.useMutation();
  const testMutation = trpc.fiscal.testConnection.useMutation();
  const utils = trpc.useUtils();

  const [step, setStep] = useState(0);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form state
  const [provider, setProvider] = useState<
    "FOCUS_NFE" | "WEBMANIA" | "NUVEM_FISCAL" | "SAFEWEB"
  >("FOCUS_NFE");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(false);
  const [emissionMode, setEmissionMode] = useState<"AUTOMATIC" | "MANUAL">(
    "MANUAL"
  );
  const [cnpj, setCnpj] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [regimeTributario, setRegimeTributario] = useState(1);
  const [ambiente, setAmbiente] = useState(2);
  const [cscId, setCscId] = useState("");
  const [csc, setCsc] = useState("");
  const [serieNfce, setSerieNfce] = useState(1);
  const [defaultCfop, setDefaultCfop] = useState("5102");
  const [defaultCsosn, setDefaultCsosn] = useState("102");
  const [defaultNcm, setDefaultNcm] = useState("21069090");
  const [logradouro, setLogradouro] = useState("");
  const [numeroEndereco, setNumeroEndereco] = useState("");
  const [bairro, setBairro] = useState("");
  const [codigoMunicipio, setCodigoMunicipio] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState("");
  const [cep, setCep] = useState("");

  // Carregar dados existentes
  useEffect(() => {
    if (config.data) {
      setProvider(config.data.provider);
      setIsActive(config.data.isActive);
      setEmissionMode(config.data.emissionMode);
      setCnpj(config.data.cnpj);
      setInscricaoEstadual(config.data.inscricaoEstadual ?? "");
      setRazaoSocial(config.data.razaoSocial);
      setNomeFantasia(config.data.nomeFantasia ?? "");
      setRegimeTributario(config.data.regimeTributario);
      setAmbiente(config.data.ambiente);
      setCscId(config.data.cscId ?? "");
      setSerieNfce(config.data.serieNfce);
      setDefaultCfop(config.data.defaultCfop);
      setDefaultCsosn(config.data.defaultCsosn);
      setDefaultNcm(config.data.defaultNcm);
      setLogradouro(config.data.logradouro ?? "");
      setNumeroEndereco(config.data.numeroEndereco ?? "");
      setBairro(config.data.bairro ?? "");
      setCodigoMunicipio(config.data.codigoMunicipio ?? "");
      setMunicipio(config.data.municipio ?? "");
      setUf(config.data.uf ?? "");
      setCep(config.data.cep ?? "");
    }
  }, [config.data]);

  const selectedProvider = PROVIDERS.find((p) => p.id === provider)!;

  function handleSave() {
    saveMutation.mutate(
      {
        provider,
        isActive,
        emissionMode,
        credentials,
        cnpj,
        inscricaoEstadual: inscricaoEstadual || undefined,
        razaoSocial,
        nomeFantasia: nomeFantasia || undefined,
        regimeTributario,
        ambiente,
        cscId: cscId || undefined,
        csc: csc || undefined,
        serieNfce,
        defaultCfop,
        defaultCsosn,
        defaultNcm,
        logradouro: logradouro || undefined,
        numeroEndereco: numeroEndereco || undefined,
        bairro: bairro || undefined,
        codigoMunicipio: codigoMunicipio || undefined,
        municipio: municipio || undefined,
        uf: uf || undefined,
        cep: cep || undefined,
      },
      {
        onSuccess: () => {
          utils.fiscal.getConfig.invalidate();
          setToast({
            type: "success",
            message: "Configuração fiscal salva com sucesso!",
          });
          setTimeout(() => {
            setToast(null);
            router.push("/restaurante/admin/fiscal");
          }, 2000);
        },
        onError: (err) => {
          setToast({
            type: "error",
            message: err.message || "Erro ao salvar configuração",
          });
          setTimeout(() => setToast(null), 5000);
        },
      }
    );
  }

  function handleTestConnection() {
    testMutation.mutate(undefined, {
      onSuccess: (result) => {
        setToast({
          type: result.success ? "success" : "error",
          message: result.message,
        });
        setTimeout(() => setToast(null), 4000);
      },
    });
  }

  if (config.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <button
          onClick={() => router.push("/restaurante/admin/fiscal")}
          className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <h1 className="text-2xl font-bold">Configuração Fiscal</h1>
        <p className="text-muted-foreground">
          Configure a emissão de NFC-e para o seu restaurante
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={`flex-1 rounded-lg px-2 py-2 text-center text-xs font-medium transition-colors ${
              i === step
                ? "bg-primary text-primary-foreground"
                : i < step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-border bg-card p-6">
        {/* Step 0: Provider */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Escolha o Provedor</h2>
            <p className="text-sm text-muted-foreground">
              Selecione a empresa que vai processar suas notas fiscais. Cada
              provedor tem sua própria API e preços.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setProvider(p.id);
                    setCredentials({});
                  }}
                  className={`rounded-xl border-2 p-4 text-left transition-colors ${
                    provider === p.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <p className="font-semibold">{p.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Credentials */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              Credenciais - {selectedProvider.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              Insira as credenciais da API do {selectedProvider.name}. Você
              encontra essas informações no painel do provedor.
            </p>
            {selectedProvider.fields.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-sm font-medium">
                  {field.label}
                </label>
                <input
                  type={field.type}
                  value={credentials[field.key] || ""}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      [field.key]: e.target.value,
                    })
                  }
                  placeholder={
                    config.data?.hasCredentials
                      ? "••• (já configurado — preencha para alterar)"
                      : `Insira o ${field.label}`
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            ))}

            {config.data?.hasCredentials && (
              <p className="text-xs text-muted-foreground">
                As credenciais atuais estão salvas. Preencha novamente apenas
                se quiser alterá-las.
              </p>
            )}
          </div>
        )}

        {/* Step 2: Company data */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Dados da Empresa</h2>
            <p className="text-sm text-muted-foreground">
              Informações fiscais do seu restaurante. Devem ser as mesmas do
              seu cartão CNPJ.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 flex items-center text-sm font-medium">
                  CNPJ
                  <Tooltip text="O CNPJ do seu restaurante, como aparece no cartão CNPJ da Receita Federal." />
                </label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center text-sm font-medium">
                  Inscrição Estadual
                  <Tooltip text="Número de registro na Secretaria da Fazenda do seu estado. Se for isento, deixe em branco." />
                </label>
                <input
                  type="text"
                  value={inscricaoEstadual}
                  onChange={(e) => setInscricaoEstadual(e.target.value)}
                  placeholder="Ex: 123456789"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 flex items-center text-sm font-medium">
                Razão Social
                <Tooltip text="O nome oficial da sua empresa, como registrado na Receita Federal." />
              </label>
              <input
                type="text"
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="Ex: Restaurante Exemplo LTDA"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 text-sm font-medium block">
                Nome Fantasia
              </label>
              <input
                type="text"
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                placeholder="Ex: Restaurante Exemplo"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center text-sm font-medium">
                Regime Tributário
                <Tooltip text="Como sua empresa paga impostos. A maioria dos pequenos restaurantes usa Simples Nacional." />
              </label>
              <select
                value={regimeTributario}
                onChange={(e) => setRegimeTributario(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {REGIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 3: Address */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Endereço Fiscal</h2>
            <p className="text-sm text-muted-foreground">
              Endereço do estabelecimento que aparecerá na nota fiscal.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Logradouro
                </label>
                <input
                  type="text"
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                  placeholder="Ex: Rua das Flores"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Número
                </label>
                <input
                  type="text"
                  value={numeroEndereco}
                  onChange={(e) => setNumeroEndereco(e.target.value)}
                  placeholder="Ex: 123"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Bairro
                </label>
                <input
                  type="text"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  placeholder="Ex: Centro"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Município
                </label>
                <input
                  type="text"
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                  placeholder="Ex: São Paulo"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 flex items-center text-sm font-medium">
                  Código IBGE
                  <Tooltip text="Código do município no IBGE. Consulte em ibge.gov.br se não souber." />
                </label>
                <input
                  type="text"
                  value={codigoMunicipio}
                  onChange={(e) => setCodigoMunicipio(e.target.value)}
                  placeholder="Ex: 3550308"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">UF</label>
                <input
                  type="text"
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase())}
                  placeholder="Ex: SP"
                  maxLength={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">CEP</label>
                <input
                  type="text"
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  placeholder="Ex: 01001-000"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: NFC-e settings */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Configurações da NFC-e</h2>
            <p className="text-sm text-muted-foreground">
              Configurações técnicas da nota fiscal. Os valores padrão
              funcionam para a maioria dos restaurantes.
            </p>

            <div>
              <label className="mb-1 flex items-center text-sm font-medium">
                Ambiente
                <Tooltip text="Use 'Teste' para simular sem emitir notas de verdade. Mude para 'Produção' quando estiver tudo funcionando." />
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setAmbiente(2)}
                  className={`flex-1 rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors ${
                    ambiente === 2
                      ? "border-yellow-400 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
                      : "border-border"
                  }`}
                >
                  Teste (Homologação)
                </button>
                <button
                  onClick={() => setAmbiente(1)}
                  className={`flex-1 rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors ${
                    ambiente === 1
                      ? "border-green-400 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : "border-border"
                  }`}
                >
                  Produção (Real)
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 flex items-center text-sm font-medium">
                  CSC ID
                  <Tooltip text="Código de Segurança do Contribuinte - fornecido pela SEFAZ do seu estado para NFC-e." />
                </label>
                <input
                  type="text"
                  value={cscId}
                  onChange={(e) => setCscId(e.target.value)}
                  placeholder="Ex: 1"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center text-sm font-medium">
                  CSC (Token SEFAZ)
                  <Tooltip text="Token secreto fornecido pela SEFAZ junto com o CSC ID. Será armazenado de forma criptografada." />
                </label>
                <input
                  type="password"
                  value={csc}
                  onChange={(e) => setCsc(e.target.value)}
                  placeholder={
                    config.data?.hasCsc
                      ? "••• (já configurado)"
                      : "Token da SEFAZ"
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 flex items-center text-sm font-medium">
                Série da NFC-e
                <Tooltip text="Número da série da NFC-e. O padrão é 1. Só altere se orientado pelo seu contador." />
              </label>
              <input
                type="number"
                value={serieNfce}
                onChange={(e) => setSerieNfce(Number(e.target.value))}
                min={1}
                className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <details className="rounded-lg border border-border p-4">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                Configurações tributárias avançadas (só altere se souber o que
                está fazendo)
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 flex items-center text-sm font-medium">
                    CFOP
                    <Tooltip text="Código Fiscal de Operações. 5102 = venda de mercadoria adquirida. Padrão para restaurantes." />
                  </label>
                  <input
                    type="text"
                    value={defaultCfop}
                    onChange={(e) => setDefaultCfop(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center text-sm font-medium">
                    CSOSN
                    <Tooltip text="Código da Situação da Operação no Simples Nacional. 102 = tributada sem permissão de crédito." />
                  </label>
                  <input
                    type="text"
                    value={defaultCsosn}
                    onChange={(e) => setDefaultCsosn(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center text-sm font-medium">
                    NCM
                    <Tooltip text="Nomenclatura Comum do Mercosul. 21069090 = preparações alimentícias. Padrão para restaurantes." />
                  </label>
                  <input
                    type="text"
                    value={defaultNcm}
                    onChange={(e) => setDefaultNcm(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Step 5: Emission mode */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Modo de Emissão</h2>
            <p className="text-sm text-muted-foreground">
              Escolha como as notas fiscais serão emitidas.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setEmissionMode("AUTOMATIC")}
                className={`rounded-xl border-2 p-5 text-left transition-colors ${
                  emissionMode === "AUTOMATIC"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <Zap className="mb-2 h-6 w-6 text-primary" />
                <p className="font-semibold">Automático</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A nota é emitida automaticamente quando o pedido é pago.
                  Recomendado.
                </p>
              </button>
              <button
                onClick={() => setEmissionMode("MANUAL")}
                className={`rounded-xl border-2 p-5 text-left transition-colors ${
                  emissionMode === "MANUAL"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <Hand className="mb-2 h-6 w-6 text-primary" />
                <p className="font-semibold">Manual</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Você clica em um botão para emitir a nota de cada pedido.
                </p>
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium">Ativar emissão fiscal</p>
                <p className="text-xs text-muted-foreground">
                  Quando ativo, notas fiscais poderão ser emitidas
                </p>
              </div>
              <button
                onClick={() => setIsActive(!isActive)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  isActive ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    isActive ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            {/* Test connection */}
            {config.data && (
              <button
                onClick={handleTestConnection}
                disabled={testMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {testMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Testar Conexão
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" />
          Anterior
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Próximo
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending || !cnpj || !razaoSocial}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Configuração
          </button>
        )}
      </div>
    </div>
  );
}
