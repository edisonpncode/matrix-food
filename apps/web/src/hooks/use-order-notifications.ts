"use client";

import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { ensureUnlockedAudioContext, playNewOrderChime } from "@/lib/audio-unlock";

/**
 * Hook global do POS — escuta pedidos novos do link público em tempo real
 * (SSE) e mantém o atendente avisado em qualquer tela.
 *
 * Comportamento:
 *  - Conecta em `/api/orders/stream` (reconecta sozinho se cair).
 *  - Toca som imediatamente ao chegar um pedido novo do link.
 *  - Toca o som de novo a cada 30s enquanto houver pedido aguardando
 *    aprovação — para quando o atendente aprova ou cancela.
 *  - Dispara Notification API (popup do SO) com permissão silenciosa.
 *  - Mantém polling de 15s como fallback caso o SSE não esteja
 *    disponível (ambiente sem suporte, proxy bloqueando, etc).
 *
 * Retorna a contagem de pedidos `PENDING` do link, para que outros
 * componentes (badge no sidebar) possam usar.
 */

const REPEAT_BEEP_INTERVAL_MS = 30_000;
const POLL_INTERVAL_MS = 15_000;

interface NewOrderEvent {
  tenantId: string;
  orderId: string;
  displayNumber: string;
  status: "PENDING" | "PREPARING";
  createdAt: string;
}

function fireNotification(
  title: string,
  body: string,
  tag: string
): Notification | null {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;
  try {
    const notif = new Notification(title, {
      body,
      tag,
      // Mantém visível enquanto o atendente não interage
      requireInteraction: true,
      silent: false,
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    return notif;
  } catch {
    return null;
  }
}

function requestNotificationPermissionSilently(): void {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    // Browsers exigem que `requestPermission` seja chamado dentro de um
    // gesto do usuário. Adiamos para o próximo clique.
    const ask = () => {
      Notification.requestPermission().catch(() => {});
      window.removeEventListener("pointerdown", ask);
      window.removeEventListener("keydown", ask);
    };
    window.addEventListener("pointerdown", ask, { once: true });
    window.addEventListener("keydown", ask, { once: true });
  }
}

export function useOrderNotifications(): { pendingCount: number } {
  const [pendingCount, setPendingCount] = useState(0);
  const knownPendingIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling de fallback — também alimenta a contagem inicial.
  const { data: orders } = trpc.order.listByTenant.useQuery(
    {},
    { refetchInterval: POLL_INTERVAL_MS }
  );

  // Pede permissão de notificação no primeiro clique do atendente.
  useEffect(() => {
    requestNotificationPermissionSilently();
    // Destrava AudioContext na primeira interação.
    ensureUnlockedAudioContext();
  }, []);

  // Atualiza contagem e detecta pedidos novos via polling (fallback).
  useEffect(() => {
    if (!orders) return;
    const pending = orders.filter(
      (o) => o.status === "PENDING" && o.source === "ONLINE"
    );
    const currentIds = new Set(pending.map((o) => o.id));
    setPendingCount(pending.length);

    // Na primeira carga, não toca som — só registra os IDs existentes.
    if (isFirstLoadRef.current) {
      knownPendingIdsRef.current = currentIds;
      isFirstLoadRef.current = false;
      return;
    }

    // Detecta IDs novos (apareceram desde a última verificação).
    const newIds: string[] = [];
    currentIds.forEach((id) => {
      if (!knownPendingIdsRef.current.has(id)) newIds.push(id);
    });
    if (newIds.length > 0) {
      playNewOrderChime();
      const first = pending.find((o) => o.id === newIds[0]);
      if (first) {
        fireNotification(
          "Novo pedido!",
          `Pedido #${first.displayNumber} aguardando aprovação`,
          `order-${first.id}`
        );
      }
    }

    knownPendingIdsRef.current = currentIds;
  }, [orders]);

  // Loop de 30s enquanto houver pedidos pendentes.
  useEffect(() => {
    if (pendingCount === 0) {
      if (repeatTimerRef.current) {
        clearInterval(repeatTimerRef.current);
        repeatTimerRef.current = null;
      }
      return;
    }
    if (repeatTimerRef.current) return;
    repeatTimerRef.current = setInterval(() => {
      playNewOrderChime();
    }, REPEAT_BEEP_INTERVAL_MS);
    return () => {
      if (repeatTimerRef.current) {
        clearInterval(repeatTimerRef.current);
        repeatTimerRef.current = null;
      }
    };
  }, [pendingCount]);

  // Conexão SSE — entrega tempo real (sem esperar polling).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof EventSource === "undefined") return;

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      es = new EventSource("/api/orders/stream");

      es.addEventListener("new-online-order", (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data) as NewOrderEvent;
          // Só toca/notifica se for PENDING (auto-aprovados não exigem ação).
          if (payload.status === "PENDING") {
            playNewOrderChime();
            fireNotification(
              "Novo pedido!",
              `Pedido #${payload.displayNumber} aguardando aprovação`,
              `order-${payload.orderId}`
            );
          }
        } catch {
          // ignora payload inválido
        }
      });

      es.onerror = () => {
        es?.close();
        es = null;
        if (cancelled) return;
        // Reconecta com backoff curto.
        reconnectTimer = setTimeout(connect, 5_000);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, []);

  return { pendingCount };
}
