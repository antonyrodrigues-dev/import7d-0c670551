import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import type { AdminOrder, AsyncState, OrderStatus } from "../types";
import { listOrders } from "../services/orders.service";
import { logEvent } from "./logs";

interface OrdersStore {
  state: AsyncState;
  error: string | null;
  orders: AdminOrder[];
  /** UI — persistido. */
  filter: OrderStatus | "todos";
  setFilter: (f: OrderStatus | "todos") => void;
  refresh: () => Promise<void>;
  /** Substitui a coleção completa. Uso restrito ao `orders.service`. */
  replace: (orders: AdminOrder[]) => void;
}

/**
 * Persistimos APENAS estado de UI (filtro). Os pedidos vêm do backend em
 * cada carga — persistir seria criar uma segunda fonte da verdade.
 */
export const useOrdersStore = create<OrdersStore>()(
  persist(
    (set) => ({
      state: "idle",
      error: null,
      orders: [],
      filter: "todos",
      setFilter: (filter) => set({ filter }),
      replace: (orders) => set({ orders }),
      refresh: async () => {
        set({ state: "loading", error: null });
        try {
          const orders = await listOrders();
          set({ orders, state: "ready" });
        } catch (e) {
          const message = (e as Error).message ?? "Falha ao carregar pedidos";
          set({ state: "error", error: message });
          logEvent("order.error", message);
          toast.error(message);
        }
      },
    }),
    {
      name: "7d-admin-orders-ui",
      partialize: (s) => ({ filter: s.filter }),
    },
  ),
);
