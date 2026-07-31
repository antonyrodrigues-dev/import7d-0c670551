import { useCallback, useEffect } from "react";
import { useFinanceOpsStore } from "../../stores/ops";
import { fetchFinanceMetrics } from "../../services/finance.service";
import { usePermissions } from "../usePermissions";

/**
 * Hook único do Financeiro.
 *
 * GATE: a requisição só é disparada quando o papel `admin` está confirmado —
 * um vendedor nunca emite a chamada e, se emitisse, a RPC bloquearia no
 * servidor. Não usa `useOrders()` nem lê a tabela `pedidos`.
 */
export function useFinance() {
  const { ready, isAdmin } = usePermissions();
  const { state, period, metrics, setPeriod, setState, set } = useFinanceOpsStore();

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    setState("loading");
    const { metrics: m, error } = await fetchFinanceMetrics(period);
    if (error) {
      setState("error");
      return;
    }
    set(m);
  }, [isAdmin, period, set, setState]);

  useEffect(() => {
    if (ready && isAdmin) void refresh();
  }, [ready, isAdmin, refresh]);

  return { state, metrics, period, setPeriod, refresh, allowed: isAdmin, ready };
}
