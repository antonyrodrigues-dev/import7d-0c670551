import { create } from "zustand";
import type { AdminOrder, AsyncState, OrderStatus } from "../types";
import { listOrders, updateOrderStatus } from "../services/orders.service";
import { useInventoryStore } from "./inventory";
import { useNotificationsStore } from "./notifications";
import { ORDER_STATUSES } from "../constants";

function statusLabel(s: OrderStatus): string {
  return ORDER_STATUSES.find((x) => x.key === s)?.label ?? s;
}

interface OrdersStore {
  state: AsyncState;
  error: string | null;
  orders: AdminOrder[];
  filter: OrderStatus | "todos";
  setFilter: (f: OrderStatus | "todos") => void;
  refresh: () => Promise<void>;
  setStatus: (id: string, status: OrderStatus, by?: string) => Promise<void>;
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
  setStatus: async (id, status, by) => {
    const prev = get().orders;
    const order = prev.find((o) => o.id === id);
    if (!order || order.status === status) return;
    const nowIso = new Date().toISOString();
    const updated: AdminOrder = {
      ...order,
      status,
      atualizadoEm: nowIso,
      responsavel: by ?? order.responsavel,
      historico: [
        ...order.historico,
        { status, at: nowIso, by, note: `Alterado para ${statusLabel(status)}` },
      ],
    };
    set({ orders: prev.map((o) => (o.id === id ? updated : o)) });

    // Propagação: estoque consome quando separado/finalizado.
    if (status === "separado" || status === "finalizado") {
      useInventoryStore.getState().applyOrderConsumption(updated);
    }
    // Propagação: notificação interna.
    useNotificationsStore.getState().push({
      kind: "pedido_novo",
      title: `Pedido ${updated.numero} · ${statusLabel(status)}`,
      body: `${updated.cliente.nome} — atualizado para ${statusLabel(status)}.`,
      priority: status === "cancelado" ? "alta" : "media",
    });

    try {
      await updateOrderStatus(id, status);
    } catch (e) {
      set({ orders: prev, error: (e as Error).message });
    }
  },
}));