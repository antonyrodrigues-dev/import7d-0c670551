import { useEffect } from "react";
import { toast } from "sonner";
import { useOrdersStore } from "../../stores/orders";
import { cancelOrderWithRefund, transitionOrderStatus } from "../../services/orders.service";
import { useOpsRealtime } from "./useOpsRealtime";
import type { OrderStatus } from "../../types";

/**
 * Hook de dados de pedidos. A lista é paginada e filtrada no servidor;
 * mudanças de status passam sempre pelo `orders.service`.
 */
export function useOrders(options: { auto?: boolean } = { auto: true }) {
  const store = useOrdersStore();
  const auto = options.auto !== false;
  const { refresh, page, query, statuses } = store;

  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(() => void refresh(), 200);
    return () => clearTimeout(id);
  }, [auto, refresh, page, query, statuses]);

  useOpsRealtime(() => void refresh(), auto);

  const setStatus = (id: string, status: OrderStatus, by?: string) =>
    transitionOrderStatus(id, status, by);
  const cancelWithRefund = async (id: string, motivo?: string): Promise<void> => {
    await cancelOrderWithRefund(id, motivo).then(
      () => toast.success("Pedido cancelado e valor estornado."),
      (e: Error) => toast.error(e.message),
    );
  };
  return { ...store, setStatus, cancelWithRefund };
}
