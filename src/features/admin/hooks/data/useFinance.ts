import { useEffect } from "react";
import { useOrdersStore } from "../../stores/orders";
import { useFinanceStore } from "../../stores/finance";
import { buildFinanceMetrics } from "../../services/finance.service";

/**
 * Hook único do Financeiro. Deriva métricas dos pedidos via
 * `finance.service` — não há consulta paralela ao banco.
 */
export function useFinance() {
  const orders = useOrdersStore((s) => s.orders);
  const period = useFinanceStore((s) => s.period);
  const setMetrics = useFinanceStore((s) => s.set);
  const setPeriod = useFinanceStore((s) => s.setPeriod);
  const metrics = useFinanceStore((s) => s.metrics);

  useEffect(() => {
    setMetrics(buildFinanceMetrics(orders, period));
  }, [orders, period, setMetrics]);

  return { metrics, period, setPeriod };
}
