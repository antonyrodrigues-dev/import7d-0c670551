import { create } from "zustand";
import type { AdminOrder, AsyncState, OrderStatus } from "../types";
import { listOrders, updateOrderStatus } from "../services/orders.service";

interface OrdersStore {
  state: AsyncState;
  error: string | null;
  orders: AdminOrder[];
  filter: OrderStatus | "todos";
  setFilter: (f: OrderStatus | "todos") => void;
  refresh: () => Promise<void>;
  setStatus: (id: string, status: OrderStatus) => Promise<void>;
}

export const useOrdersStore = create<OrdersStore>((set, get) => ({
  state: "idle",
  error: null,
  orders: [],
  filter: "todos",
  setFilter: (filter) => set({ filter }),
  refresh: async () => {
    set({ state: "loading", error: null });
    try {
      const orders = await listOrders();
      set({ orders, state: "ready" });
    } catch (e) {
      set({ state: "error", error: (e as Error).message ?? "Falha ao carregar pedidos" });
    }
  },
  setStatus: async (id, status) => {
    const prev = get().orders;
    set({ orders: prev.map((o) => (o.id === id ? { ...o, status } : o)) });
    try {
      await updateOrderStatus(id, status);
    } catch (e) {
      set({ orders: prev, error: (e as Error).message });
    }
  },
}));