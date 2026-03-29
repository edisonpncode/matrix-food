"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UtensilsCrossed,
  ArrowLeft,
  ArrowRight,
  User,
  Store,
  Check,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// ==========================================
// Tipos de comida disponíveis
// ==========================================
const FOOD_TYPES = [
  { id: "hamburguer", label: "Hambúrguer" },
  { id: "pizza", label: "Pizza" },
  { id: "acai", label: "Açaí" },
  { id: "pastel", label: "Pastel" },
  { id: "esfiha", label: "Esfiha" },
  { id: "japones", label: "Japonês / Sushi" },
  { id: "marmitex", label: "Marmitex / Refeição" },
  { id: "salgados", label: "Salgados" },
  { id: "doces", label: "Doces / Confeitaria" },
  { id: "sorvete", label: "Sorvete / Gelato" },
  { id: "bebidas", label: "Bebidas" },
  { id: "padaria", label: "Padaria" },
  { id: "churrasco", label: "Churrasco" },
  { id: "frango", label: "Frango / Assados" },
  { id: "fit", label: "Fit / Saudável" },
  { id: "arabe", label: "Árabe" },
  { id: "mexicano", label: "Mexicano" },
  { id: "italiano", label: "Italiano" },
  { id: "cafe", label: "Café / Cafeteria" },
  { id: "outro", label: "Outro" },
];

// ==========================================
// Estados brasileiros
// ==========================================
const STATES = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];

// ==========================================
// Força da senha
// ==========================================
function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: "Fraca", color: "bg-red-500", width: "w-1/4" };
  if (score <= 2) return { label: "Razoável", color: "bg-orange-500", width: "w-2/4" };
  if (score <= 3) return { label: "Boa", color: "bg-yellow-500", width: "w-3/4" };
  return { label: "Forte", color: "bg-green-500", width: "w-full" };
}

// ==========================================
// Componente principal
// ==========================================
export default function CadastroPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1 - Owner data
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  // Step 2 - Restaurant data
  const [restaurantName, setRestaurantName] = useState("");
  const [selectedFoodTypes, setSelectedFoodTypes] = useState<string[]>([]);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // IBGE cities
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);

  const registerMutation = trpc.tenant.register.useMutation();

  // Buscar cidades quando o estado muda
  useEffect(() => {
    if (!state) {
      setCities([]);
      setCity("");
      setCitySearch("");
      return;
    }

    setLoadingCities(true);
    setCity("");
    setCitySearch("");

    const stateObj = STATES.find((s) => s.uf === state);
    if (!stateObj) return;

    // IBGE API - buscar cidades do estado
    fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state}/municipios?orderBy=nome`
    )
      .then((res) => res.json())
      .then((data: Array<{ nome: string }>) => {
        setCities(data.map((c) => c.nome));
      })
      .catch(() => {
        setCities([]);
      })
      .finally(() => setLoadingCities(false));
  }, [state]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setShowCityDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredCities = citySearch
    ? cities.filter((c) =>
        c.toLowerCase().startsWith(citySearch.toLowerCase())
      )
    : cities;

  const canProceedStep1 = ownerName.trim();
  const canFinish =
    restaurantName.trim() &&
    selectedFoodTypes.length > 0 &&
    state &&
    city &&
    email.trim() &&
    password.length >= 6;

  const passwordStrength = password ? getPasswordStrength(password) : null;

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7)
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function toggleFoodType(id: string) {
    setSelectedFoodTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function handleFinish() {
    setLoading(true);
    setError("");

    try {
      // 1. Criar usuário no Firebase Auth
      const { initializeApp, getApps } = await import("firebase/app");
      const { getAuth, createUserWithEmailAndPassword } = await import(
        "firebase/auth"
      );

      // Inicializar Firebase se ainda não foi
      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      };

      const app =
        getApps().length > 0
          ? getApps()[0]
          : initializeApp(firebaseConfig);

      const auth = getAuth(app);
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // 2. Registrar no backend
      await registerMutation.mutateAsync({
        ownerName,
        ownerPhone: ownerPhone || undefined,
        restaurantName,
        foodTypes: selectedFoodTypes,
        state,
        city,
        email,
        firebaseUid: userCredential.user.uid,
      });

      // 3. Redirecionar para o admin
      router.push("/restaurante/admin");
    } catch (err: unknown) {
      if (err instanceof Error) {
        // Traduzir erros comuns do Firebase
        if (err.message.includes("email-already-in-use")) {
          setError("Este email já está cadastrado. Tente fazer login.");
        } else if (err.message.includes("weak-password")) {
          setError("A senha precisa ter pelo menos 6 caracteres.");
        } else if (err.message.includes("invalid-email")) {
          setError("Email inválido.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[#e2e8f0] bg-[#fafafa] px-4 py-3 text-sm text-[#1a1a2e] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10";

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#fafafa] px-5 py-12">
      {/* Decorative orb */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-gradient-to-br from-purple-400/15 to-violet-600/5 blur-[100px]" />

      <div className="relative z-10 w-full max-w-lg">
        {/* Back */}
        <Link
          href="/restaurante"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#64748b] transition-colors hover:text-[#7c3aed]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] shadow-lg shadow-purple-500/25">
            <UtensilsCrossed className="h-7 w-7 text-white" />
          </div>
          <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#1a1a2e]">
            Criar sua conta
          </h1>
          <p className="text-sm text-[#64748b]">
            {step === 1
              ? "Primeiro, seus dados pessoais"
              : "Agora, os dados do restaurante"}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                step >= 1
                  ? "bg-[#7c3aed] text-white"
                  : "bg-[#e2e8f0] text-[#94a3b8]"
              }`}
            >
              {step > 1 ? (
                <Check className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
            <span
              className={`text-sm font-medium ${
                step >= 1 ? "text-[#1a1a2e]" : "text-[#94a3b8]"
              }`}
            >
              Seus Dados
            </span>
          </div>
          <div className="h-px flex-1 bg-[#e2e8f0]">
            <div
              className="h-full bg-[#7c3aed] transition-all duration-500"
              style={{ width: step >= 2 ? "100%" : "0%" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                step >= 2
                  ? "bg-[#7c3aed] text-white"
                  : "bg-[#e2e8f0] text-[#94a3b8]"
              }`}
            >
              <Store className="h-4 w-4" />
            </div>
            <span
              className={`text-sm font-medium ${
                step >= 2 ? "text-[#1a1a2e]" : "text-[#94a3b8]"
              }`}
            >
              Restaurante
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-8">
          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                  Nome completo *
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Seu nome"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                  Celular / WhatsApp
                </label>
                <input
                  type="tel"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(formatPhone(e.target.value))}
                  placeholder="(99) 99999-9999"
                  className={inputClass}
                />
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-purple-500/20 transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prosseguir
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Nome do restaurante */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                  Nome do restaurante *
                </label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Ex: Point Lanches"
                  className={inputClass}
                />
              </div>

              {/* Tipos de comida */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1a1a2e]">
                  O que você vende? *
                  <span className="ml-1 text-xs font-normal text-[#94a3b8]">
                    (selecione um ou mais)
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {FOOD_TYPES.map((ft) => {
                    const selected = selectedFoodTypes.includes(ft.id);
                    return (
                      <button
                        key={ft.id}
                        type="button"
                        onClick={() => toggleFoodType(ft.id)}
                        className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition-all ${
                          selected
                            ? "border-[#7c3aed] bg-[#7c3aed]/10 text-[#7c3aed]"
                            : "border-[#e2e8f0] bg-[#fafafa] text-[#64748b] hover:border-[#c4b5fd] hover:text-[#7c3aed]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              selected
                                ? "border-[#7c3aed] bg-[#7c3aed]"
                                : "border-[#cbd5e1]"
                            }`}
                          >
                            {selected && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          {ft.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Estado e Cidade */}
              <div className="grid grid-cols-2 gap-3">
                {/* Estado */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                    Estado *
                  </label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">UF...</option>
                    {STATES.map((s) => (
                      <option key={s.uf} value={s.uf}>
                        {s.uf} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cidade */}
                <div ref={cityRef} className="relative">
                  <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    value={city || citySearch}
                    onChange={(e) => {
                      setCitySearch(e.target.value);
                      setCity("");
                      setShowCityDropdown(true);
                    }}
                    onFocus={() => state && setShowCityDropdown(true)}
                    placeholder={
                      !state
                        ? "Selecione o estado"
                        : loadingCities
                          ? "Carregando..."
                          : "Digite a cidade"
                    }
                    disabled={!state || loadingCities}
                    className={`${inputClass} disabled:opacity-50`}
                  />

                  {/* Dropdown de cidades */}
                  {showCityDropdown && filteredCities.length > 0 && (
                    <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-[#e2e8f0] bg-white shadow-lg">
                      {filteredCities.slice(0, 50).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setCity(c);
                            setCitySearch("");
                            setShowCityDropdown(false);
                          }}
                          className="block w-full px-4 py-2 text-left text-sm text-[#1a1a2e] hover:bg-[#7c3aed]/5 hover:text-[#7c3aed]"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                  Email (será seu login) *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className={inputClass}
                />
              </div>

              {/* Senha */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1a1a2e]">
                  Senha *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {/* Indicador de força */}
                {passwordStrength && (
                  <div className="mt-2">
                    <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color} ${passwordStrength.width}`}
                      />
                    </div>
                    <span className="text-xs text-[#64748b]">
                      Senha: {passwordStrength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Erro */}
              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#e2e8f0] px-5 py-3 text-sm font-semibold text-[#64748b] transition-all hover:border-[#7c3aed]/30 hover:text-[#7c3aed]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </button>
                <button
                  onClick={handleFinish}
                  disabled={!canFinish || loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-purple-500/20 transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Concluir Cadastro
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Login link */}
        <p className="mt-6 text-center text-sm text-[#64748b]">
          Já tem conta?{" "}
          <Link
            href="/restaurante/login"
            className="font-semibold text-[#7c3aed] hover:underline"
          >
            Faça login
          </Link>
        </p>
      </div>
    </main>
  );
}
