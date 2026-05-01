"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { formatCpf, isValidCpf } from "@matrix-food/utils";
import { ContaShell } from "../conta-shell";

export default function PerfilPage() {
  const { customer, refetch } = useCustomerAuth();
  const updateMe = trpc.customerPortal.updateMe.useMutation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (customer) {
      setName(customer.name ?? "");
      setEmail(customer.email ?? "");
      setCpf(customer.cpf ? formatCpf(customer.cpf) : "");
    }
  }, [customer]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setServerError(null);
    setCpfError(null);

    if (cpf && !isValidCpf(cpf)) {
      setCpfError("CPF inválido. Confira os dígitos.");
      return;
    }

    try {
      await updateMe.mutateAsync({
        name: name || undefined,
        email: email || null,
        cpf: cpf || null,
      });
      await refetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha ao salvar dados.";
      setServerError(message);
    }
  }

  return (
    <ContaShell title="Meu cadastro" backHref="/">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Dados pessoais
          </h2>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nome completo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Telefone
              </label>
              <input
                type="text"
                value={customer?.phone ?? ""}
                disabled
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                O telefone foi confirmado e não pode ser alterado.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                CPF
              </label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => {
                  setCpf(formatCpf(e.target.value));
                  if (cpfError) setCpfError(null);
                }}
                placeholder="000.000.000-00"
                inputMode="numeric"
                maxLength={14}
                className={`w-full rounded-lg border px-3 py-2.5 focus:outline-none focus:ring-2 ${
                  cpfError
                    ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                    : "border-gray-300 focus:border-primary focus:ring-primary/20"
                }`}
              />
              {cpfError && (
                <p className="mt-1 text-xs text-red-600">{cpfError}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                O CPF é exigido para fazer pedidos.
              </p>
            </div>
          </div>
        </div>

        {serverError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </p>
        )}
        {saved && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Dados salvos com sucesso!
          </p>
        )}

        <button
          type="submit"
          disabled={updateMe.isPending}
          className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {updateMe.isPending ? "Salvando..." : "Salvar alterações"}
        </button>
      </form>
    </ContaShell>
  );
}
