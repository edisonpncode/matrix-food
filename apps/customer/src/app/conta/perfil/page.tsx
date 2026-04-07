"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCustomerAuth } from "@/lib/customer-auth-context";

export default function PerfilPage() {
  const { customer, refresh } = useCustomerAuth();
  const updateMe = trpc.customerPortal.updateMe.useMutation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (customer) {
      setName(customer.name ?? "");
      setEmail(customer.email ?? "");
      setCpf(customer.cpf ?? "");
    }
  }, [customer]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    await updateMe.mutateAsync({
      name: name || undefined,
      email: email || null,
      cpf: cpf || null,
    });
    await refresh();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!customer) return null;

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Dados pessoais</h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nome completo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Telefone
            </label>
            <input
              type="text"
              value={customer.phone ?? ""}
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              O telefone foi confirmado pelo SMS e nao pode ser alterado.
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              CPF
            </label>
            <input
              type="text"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="000.000.000-00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>
        </div>
      </div>

      {saved && (
        <p className="text-sm text-green-600">Dados salvos com sucesso!</p>
      )}

      <button
        type="submit"
        disabled={updateMe.isPending}
        className="w-full rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
      >
        {updateMe.isPending ? "Salvando..." : "Salvar alteracoes"}
      </button>
    </form>
  );
}
