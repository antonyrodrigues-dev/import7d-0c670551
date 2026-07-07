import { useEffect } from "react";
import { useOrdersStore } from "../../stores/orders";
import { useInventoryStore } from "../../stores/inventory";
import { useCustomersStore } from "../../stores/customers";
import { useDashboardStore } from "../../stores/dashboard";
import { buildDashboardMetrics } from "../../services/dashboard.service";

/**
 * Fluxo unico de metricas: DashboardService -> DashboardStore -> cards.
 * Nenhum card calcula seus proprios valores.
 */
export function useDashboard() {
  const orders = useOrdersStore((s) => s.orders);
  const inventory = useInventoryStore((s) => s.items);
  const customers = useCustomersStore((s) => s.customers);
  const setMetrics = useDashboardStore((s) => s.set);
  const metrics = useDashboardStore((s) => s.metrics);
  const loading = useDashboardStore((s) => s.loading);

  useEffect(() => {
    setMetrics(buildDashboardMetrics(orders, inventory, customers.length));
  }, [orders, inventory, customers, setMetrics]);

  return { metrics, loading };
}
