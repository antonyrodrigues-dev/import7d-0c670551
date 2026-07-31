import { useEffect, useRef } from "react";
import { opsDataSource } from "../../adapters/ops";

/**
 * Sincronização em tempo real das mudanças operacionais (pedidos, reservas,
 * notificações). Uma única assinatura por consumidor; o callback mais recente
 * é sempre usado, sem recriar o canal a cada render.
 */
export function useOpsRealtime(onChange: () => void, enabled = true): void {
  const ref = useRef(onChange);
  ref.current = onChange;

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = opsDataSource.subscribeOps(() => ref.current());
    return unsubscribe;
  }, [enabled]);
}