/**
 * 7D IMPORTS — EventBus interno do painel administrativo.
 *
 * Desacopla domínios: um Service emite (`emit`) e os interessados assinam
 * (`subscribe`). Nenhuma store deve chamar outra store diretamente — a
 * comunicação cross-domain acontece por aqui.
 *
 * Ex.: `orders.service` emite `order.status.changed` e o dashboard/
 * notificações reagem sem se conhecerem.
 */

export type AdminEventMap = {
  "order.created": { orderId: string; numero: string };
  "order.status.changed": {
    orderId: string;
    numero: string;
    from: string;
    to: string;
    by?: string;
  };
  "order.cancelled": { orderId: string; numero: string; by?: string };
  "inventory.movement": {
    slug: string;
    size: string;
    kind: "entrada" | "saida" | "ajuste" | "reposicao" | "consumo";
    qty: number;
  };
  "inventory.low": { slug: string; quantity: number };
  "notification.created": { id: string; kind: string };
  "settings.updated": { keys: string[] };
  "auth.session.changed": { userId: string | null };
};

export type AdminEvent = keyof AdminEventMap;
export type AdminEventHandler<E extends AdminEvent> = (payload: AdminEventMap[E]) => void;
export type Unsubscribe = () => void;

const listeners: {
  [E in AdminEvent]?: Set<AdminEventHandler<E>>;
} = {};

export function subscribe<E extends AdminEvent>(
  event: E,
  handler: AdminEventHandler<E>,
): Unsubscribe {
  const set = (listeners[event] ??= new Set()) as Set<AdminEventHandler<E>>;
  set.add(handler);
  return () => unsubscribe(event, handler);
}

export function unsubscribe<E extends AdminEvent>(
  event: E,
  handler: AdminEventHandler<E>,
): void {
  (listeners[event] as Set<AdminEventHandler<E>> | undefined)?.delete(handler);
}

export function emit<E extends AdminEvent>(event: E, payload: AdminEventMap[E]): void {
  const set = listeners[event] as Set<AdminEventHandler<E>> | undefined;
  if (!set) return;
  for (const handler of set) {
    try {
      handler(payload);
    } catch {
      // Um listener quebrado nunca pode contaminar os demais nem a operação
      // que emitiu o evento. Erros de listener são silenciosamente ignorados
      // — o logger já registrou a operação principal.
    }
  }
}

/** Uso apenas em testes / auditoria. */
export function _clearAllListeners(): void {
  for (const key of Object.keys(listeners) as AdminEvent[]) {
    listeners[key] = undefined;
  }
}

export function _listenerCount(): number {
  return (Object.keys(listeners) as AdminEvent[]).reduce(
    (a, k) => a + (listeners[k]?.size ?? 0),
    0,
  );
}