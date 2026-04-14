"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  addresses: Array<{
    label: string;
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
  }> | null;
}

interface CustomerAuthContextValue {
  customer: CustomerProfile | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(
  null
);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/customer/auth/session", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) {
        setCustomer(null);
        return;
      }
      const data = (await res.json()) as { customer: CustomerProfile | null };
      setCustomer(data.customer);
    } catch (err) {
      console.error("fetch customer session failed:", err);
      setCustomer(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/customer/auth/session", {
        method: "DELETE",
        credentials: "include",
      });
    } catch (err) {
      console.error("logout failed:", err);
    }
    setCustomer(null);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const value = useMemo<CustomerAuthContextValue>(
    () => ({ customer, isLoading, refetch, logout }),
    [customer, isLoading, refetch, logout]
  );

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) {
    throw new Error(
      "useCustomerAuth must be used inside <CustomerAuthProvider>"
    );
  }
  return ctx;
}
