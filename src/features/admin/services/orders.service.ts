/**
 * Serviço de pedidos administrativos — camada única entre stores/UI e o
 * dataSource. Não conhece qual backend está por trás; delega ao adapter.
 */

import { toast } from "sonner";
import { adminDataSource } from "../adapters";
import type { AdminOrder, OrderStatus } from "../types";
import { useOrdersStore } from "../stores/orders";
import { registerConsumption } from "./inventory.service";
import { notify } from "./notifications.service";
import { validateStatusTransition } from "../lib/validators";
import { ORDER_STATUSES } from "../constants";
import { logEvent } from "../stores/logs";

function statusLabel(s: OrderStatus): string {
  return ORDER_STATUSES.find((x) => x.key === s)?.label ?? s;
}

export function listOrders(): Promise<AdminOrder[]> {
  return adminDataSource.listOrders();
}

/** Persistência bruta. Uso interno; consumidores usam `transitionOrderStatus`. */
export function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  return adminDataSource.updateOrderStatus(id, status);
}

/**
 * Ponto de entrada canônico para qualquer mudança de status.
 * Orquestra validação → store → propagação (estoque, notificações, log) → adapter.
 */
export async function transitionOrderStatus(
  id: string,
  status: OrderStatus,
  by?: string,
): Promise<void> {
  const store = useOrdersStore.getState();
  const prev = store.orders;
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
  store.replace(prev.map((o) => (o.id === id ? updated : o)));

  if (status === "separado" || status === "finalizado") {
    registerConsumption(updated);
  }

  notify({
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
    store.replace(prev);
    logEvent("order.error", message, { orderId: id });
    toast.error(`Rollback: ${message}`);
  }
}
