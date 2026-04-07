"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "./firebase";
import { trpc } from "./trpc";

interface CustomerProfile {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
}

interface CustomerAuthContextValue {
  firebaseUser: User | null;
  customer: CustomerProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const meQuery = trpc.customerPortal.getMe.useQuery(undefined, {
    enabled: !!firebaseUser,
    retry: false,
  });

  const linkOrCreate = trpc.customerPortal.linkOrCreate.useMutation();

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const idToken = await user.getIdToken();
          // Cria cookie de sessão no servidor
          await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
          // Garante que o customer existe no banco
          await linkOrCreate.mutateAsync({
            firebaseUid: user.uid,
            phone: user.phoneNumber ?? "",
          });
          await meQuery.refetch();
        } catch (err) {
          console.error("Failed to bootstrap customer session:", err);
        }
      } else {
        await fetch("/api/auth/session", { method: "DELETE" });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value = useMemo<CustomerAuthContextValue>(
    () => ({
      firebaseUser,
      customer: meQuery.data
        ? {
            id: meQuery.data.id,
            name: meQuery.data.name,
            phone: meQuery.data.phone,
            email: meQuery.data.email,
            cpf: meQuery.data.cpf,
          }
        : null,
      loading: loading || (!!firebaseUser && meQuery.isLoading),
      signOut: async () => {
        await signOut(getFirebaseAuth());
      },
      refresh: async () => {
        await meQuery.refetch();
      },
    }),
    [firebaseUser, loading, meQuery.data, meQuery.isLoading]
  );

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) {
    throw new Error("useCustomerAuth must be used inside CustomerAuthProvider");
  }
  return ctx;
}
