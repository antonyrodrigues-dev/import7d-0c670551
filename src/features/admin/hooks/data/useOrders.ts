import { useEffect } from "react";
import { toast } from "sonner";
import { useOrdersStore } from "../../stores/orders";
import { transitionOrderStatus } from "../../services/orders.service";
import type { OrderStatus } from "../../types";

/**
 * Hook de dados de pedidos. Ciclo de vida da store + expõe `setStatus`
 * mediado pelo `orders.service` — nenhum componente muda status direto na store.
 */
export function useOrders(options: { auto?: boolean } = { auto: true }) {
  const store = useOrdersStore();
  useEffect(() => {
    if (options.auto) {
      void store.refresh().catch((e: Error) => toast.error(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setStatus = (id: string, status: OrderStatus, by?: string) =>
    transitionOrderStatus(id, status, by);
  return { ...store, setStatus };
}