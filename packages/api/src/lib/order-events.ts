import { EventEmitter } from "node:events";

/**
 * Bus de eventos de pedidos em memória (singleton no processo Node).
 *
 * Uso atual: emitir `new-online-order` quando o cliente cria pedido pelo
 * link público para que clientes SSE conectados (atendentes/gerentes
 * logados no POS) recebam notificação em tempo real.
 *
 * Limitação conhecida: este emitter é local ao processo. Se a aplicação
 * for escalada horizontalmente (múltiplas instâncias Node), eventos
 * disparados em uma instância NÃO chegarão a clientes SSE conectados
 * em outra. Para escalar, trocar por Redis Pub/Sub ou similar.
 *
 * Padrão de singleton via globalThis: garante uma única instância mesmo
 * com hot-reload do Next.js em dev.
 */

export interface NewOnlineOrderPayload {
  tenantId: string;
  orderId: string;
  displayNumber: string;
  /** "PENDING" (espera aprovação) ou "PREPARING" (auto-aprovado). */
  status: "PENDING" | "PREPARING";
  /** Timestamp ISO de criação. */
  createdAt: string;
}

export type OrderEventMap = {
  "new-online-order": [NewOnlineOrderPayload];
};

class OrderEventBus extends EventEmitter {
  emit<K extends keyof OrderEventMap>(
    event: K,
    ...args: OrderEventMap[K]
  ): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof OrderEventMap>(
    event: K,
    listener: (...args: OrderEventMap[K]) => void
  ): this {
    return super.on(event, listener);
  }

  off<K extends keyof OrderEventMap>(
    event: K,
    listener: (...args: OrderEventMap[K]) => void
  ): this {
    return super.off(event, listener);
  }
}

const GLOBAL_KEY = Symbol.for("@matrix-food/order-events");

type GlobalWithBus = typeof globalThis & {
  [GLOBAL_KEY]?: OrderEventBus;
};

const g = globalThis as GlobalWithBus;

if (!g[GLOBAL_KEY]) {
  const bus = new OrderEventBus();
  bus.setMaxListeners(0);
  g[GLOBAL_KEY] = bus;
}

export const orderEvents: OrderEventBus = g[GLOBAL_KEY];
