import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import type { AdminOrder, AsyncState, OrderStatus } from "../types";
import { listOrders, updateOrderStatus } from "../services/orders.service";
import { useInventoryStore } from "./inventory";
import { useNotificationsStore } from "./notifications";
import { ORDER_STATUSES } from "../constants";
import { validateStatusTransition } from "../lib/validators";
import { logEvent } from "./logs";

function statusLabel(s: OrderStatus): string {
  return ORDER_STATUSES.find((x) => x.key === s)?.label ?? s;
}

interface OrdersStore {
  state: AsyncState;
  error: string | null;
  orders: AdminOrder[];
  /** UI — persistido. */
  filter: OrderStatus | "todos";
  setFilter: (f: OrderStatus | "todos") => void;
  refresh: () => Promise<void>;
  setStatus: (id: string, status: OrderStatus, by?: string) => Promise<void>;
}

/**
 * Persistimos APENAS estado de UI (filtro). Os pedidos vêm do backend em
 * cada carga — persistir seria criar uma segunda fonte da verdade.
 */
export const useOrdersStore = create<OrdersStore>()(
  persist(
    (set, get) => ({
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
          const message = (e as Error).message ?? "Falha ao carregar pedidos";
          set({ state: "error", error: message });
          logEvent("order.error", message);
          toast.error(message);
        }
      },
      setStatus: async (id, status, by) => {
        const prev = get().orders;
        const order = prev.find((o) => o.id === id);
        if (!order) {
          toast.error("Pedido inexistente.");
          return;
        }
        if (order.status === status) return;

        const t = validateStatusTransition(order.status, status);
        if (!t.ok) {
          toast.error(t.errors[0] ?? "Transição inválida.");
          return;
        }

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

        // Propagação: estoque consome quando separado/finalizado (idempotente).
        if (status === "separado" || status === "finalizado") {
          useInventoryStore.getState().applyOrderConsumption(updated);
        }

        useNotificationsStore.getState().push({
          kind: "pedido_novo",
          title: `Pedido ${updated.numero} · ${statusLabel(status)}`,
          body: `${updated.cliente.nome} — atualizado para ${statusLabel(status)}.`,
          priority: status === "cancelado" ? "alta" : "media",
        });

        logEvent("order.status", `${updated.numero}: ${order.status} → ${status}`, {
          orderId: id,
          by,
        });

        try {
          await updateOrderStatus(id, status);
        } catch (e) {
          const message = (e as Error).message ?? "Falha ao salvar status.";
          set({ orders: prev, error: message });
          logEvent("order.error", message, { orderId: id });
          toast.error(`Rollback: ${message}`);
        }
      },
    }),
    {
      name: "7d-admin-orders-ui",
      partialize: (s) => ({ filter: s.filter }),
    },
  ),
);
