"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useOrderNotifications } from "@/hooks/use-order-notifications";

interface OrderNotificationsContextValue {
  pendingCount: number;
}

const OrderNotificationsContext =
  createContext<OrderNotificationsContextValue>({ pendingCount: 0 });

export function OrderNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { pendingCount } = useOrderNotifications();
  return (
    <OrderNotificationsContext.Provider value={{ pendingCount }}>
      {children}
    </OrderNotificationsContext.Provider>
  );
}

export function useOrderNotificationsContext(): OrderNotificationsContextValue {
  return useContext(OrderNotificationsContext);
}
