import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import type { AdminOrder, AsyncState, OrderStatus } from "../types";
import { listOrdersPage } from "../services/orders.service";
import { logEvent } from "./logs";

export const ORDERS_PAGE_SIZE = 25;

interface OrdersStore {
  state: AsyncState;
  error: string | null;
  /** Página atual — NUNCA a base inteira. A filtragem é server-side. */
  orders: AdminOrder[];
  total: number;
  page: number;
  query: string;
  statuses: OrderStatus[];
  setQuery: (q: string) => void;
  setPage: (p: number) => void;
  setStatuses: (s: OrderStatus[]) => void;
  refresh: () => Promise<void>;
  /** Substitui a página corrente. Uso restrito ao `orders.service`. */
  replace: (orders: AdminOrder[]) => void;
}

/**
 * Persistimos APENAS estado de UI. Os pedidos vêm paginados do servidor a
 * cada carga — persistir seria criar uma segunda fonte da verdade.
 */
export const useOrdersStore = create<OrdersStore>()(
  persist(
    (set, get) => ({
      state: "idle",
      error: null,
      orders: [],
      total: 0,
      page: 1,
      query: "",
      statuses: [],
      setQuery: (query) => set({ query, page: 1 }),
      setPage: (page) => set({ page }),
      setStatuses: (statuses) => set({ statuses, page: 1 }),
      replace: (orders) => set({ orders }),
      refresh: async () => {
        const { page, query, statuses } = get();
        set({ state: "loading", error: null });
        try {
          const { orders, total } = await listOrdersPage({
            statuses,
            busca: query,
            offset: (page - 1) * ORDERS_PAGE_SIZE,
            limit: ORDERS_PAGE_SIZE,
          });
          set({ orders, total, state: "ready" });
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
      partialize: (s) => ({ query: s.query }),
    },
  ),
);
