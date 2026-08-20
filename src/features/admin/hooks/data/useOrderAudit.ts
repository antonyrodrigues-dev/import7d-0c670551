import { useCallback, useEffect, useState } from "react";
import { listOrderAudit } from "../../services/orders.service";
import type { AdminAsyncState } from "../../types";
import type { OrderAuditEntry } from "../../adapters/types";

/**
 * Trilha de auditoria de um pedido. Somente leitura: a tabela é imutável
 * no banco, então não existe mutação nem estado otimista aqui.
 */
export function useOrderAudit(orderId: string | null, enabled = true) {
  const [state, setState] = useState<AdminAsyncState>("idle");
  const [events, setEvents] = useState<OrderAuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!orderId || !enabled) {
      setEvents([]);
      setState("idle");
      return;
    }
    setState("loading");
    setError(null);
    try {
      setEvents(await listOrderAudit(orderId));
      setState("success");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }, [orderId, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { events, state, error, refresh };
}
