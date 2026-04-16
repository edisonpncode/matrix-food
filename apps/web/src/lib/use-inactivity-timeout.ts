"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos
const EVENTS: (keyof DocumentEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
];

interface UseInactivityTimeoutOptions {
  /** Duração do timeout em milissegundos. Default: 15 minutos */
  timeoutMs?: number;
  /** Se true, não monitora inatividade */
  disabled?: boolean;
  /** Callback invocado quando o timeout é atingido */
  onTimeout?: () => void;
}

/**
 * Dispara `onTimeout` após N minutos sem interação do usuário
 * (mouse, teclado, scroll, touch). Retorna `locked` que vira true
 * quando o timeout ocorre — use para mostrar um modal de PIN.
 *
 * Uso típico (apenas no Admin):
 *   const { locked, unlock } = useInactivityTimeout({ timeoutMs: 15*60*1000 });
 *   if (locked) return <RequirePinModal onSuccess={unlock} />;
 */
export function useInactivityTimeout(options: UseInactivityTimeoutOptions = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, disabled = false, onTimeout } = options;
  const [locked, setLocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (disabled) return;

    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setLocked(true);
        onTimeout?.();
      }, timeoutMs);
    }

    for (const ev of EVENTS) {
      window.addEventListener(ev, reset, { passive: true });
    }

    reset(); // inicia o timer

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const ev of EVENTS) {
        window.removeEventListener(ev, reset);
      }
    };
  }, [timeoutMs, disabled, onTimeout]);

  function unlock() {
    setLocked(false);
  }

  return { locked, unlock };
}
