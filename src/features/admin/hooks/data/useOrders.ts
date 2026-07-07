import { useEffect } from "react";
import { toast } from "sonner";
import { useOrdersStore } from "../../stores/orders";

/**
 * Hook de dados de pedidos. Cuida do ciclo de vida (fetch inicial, refetch,
 * erro → toast). Componentes não devem chamar a store diretamente para
 * disparar `refresh()`.
 */
export function useOrders(options: { auto?: boolean } = { auto: true }) {
  const store = useOrdersStore();
  useEffect(() => {
    if (options.auto) {
      void store.refresh().catch((e: Error) => toast.error(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return store;
}