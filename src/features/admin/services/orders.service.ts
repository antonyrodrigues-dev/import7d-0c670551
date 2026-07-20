/**
 * Serviço de pedidos administrativos — camada única entre stores/UI e o
 * dataSource. Não conhece qual backend está por trás; delega ao adapter.
 */

import { adminDataSource } from "../adapters";
import type { AdminOrder, OrderStatus } from "../types";
import { useOrdersStore } from "../stores/orders";
import { registerConsumption, restoreConsumption } from "./inventory.service";
import { useInventoryStore } from "../stores/inventory";
import { notify } from "./notifications.service";
import { validateStatusTransition } from "../lib/validators";
import { ORDER_STATUSES } from "../constants";
import { runAdminTransaction } from "../lib/transaction";
import { createAdminError, handleAdminError } from "../lib/errors";
import { logger } from "../lib/logger";
import { emit } from "../lib/eventBus";

function statusLabel(s: OrderStatus): string {
  return ORDER_STATUSES.find((x) => x.key === s)?.label ?? s;
}

/** Guard de concorrência: bloqueia transições concorrentes sobre o mesmo pedido. */
const inFlight = new Set<string>();

export function listOrders(): Promise<AdminOrder[]> {
  return adminDataSource.listOrders().catch((e) => {
    throw handleAdminError(e, "orders.service.listOrders");
  });
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
  if (inFlight.has(id)) {
    logger.warn(`Transição ignorada: pedido ${id} já em processamento.`, {
      kind: "order.status",
      orderId: id,
    });
    return;
  }
  const store = useOrdersStore.getState();
  const order = store.orders.find((o) => o.id === id);
  if (!order) {
    handleAdminError(
      createAdminError("not_found", "Pedido inexistente.", "orders.service.transition"),
      "orders.service.transition",
    );
    return;
  }
  if (order.status === status) return;
  inFlight.add(id);

  try {
    const t = validateStatusTransition(order.status, status);
    if (!t.ok) {
      handleAdminError(
        createAdminError(
          "validation",
          t.errors[0] ?? "Transição inválida.",
          "orders.service.transition",
        ),
        "orders.service.transition",
      );
      return;
    }

    await runAdminTransaction(
      { name: "order.status", origin: "orders.service.transition" },
      async () => {
        // 1) Persistência primeiro — se falhar, o rollback natural mantém a store intacta.
        await updateOrderStatus(id, status);

        // 2) Propaga estoque.
        let stockTouched = false;
        if (status === "separado" || status === "finalizado") {
          await registerConsumption(order);
          stockTouched = true;
        } else if (status === "cancelado") {
          // Restaura consumo se já havia sido aplicado (ex.: separado → cancelado).
          await restoreConsumption(order);
          stockTouched = true;
        }
        // Refresca a store de estoque para que Dashboard/Listagem enxerguem o delta.
        if (stockTouched) {
          void useInventoryStore.getState().refresh();
        }

        // 3) Atualiza a store (fonte da UI) após confirmação do adapter.
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
        useOrdersStore
          .getState()
          .replace(useOrdersStore.getState().orders.map((o) => (o.id === id ? updated : o)));

        // 4) Notificações + logs + eventos.
        notify({
          kind: "pedido_novo",
          title: `Pedido ${updated.numero} · ${statusLabel(status)}`,
          body: `${updated.cliente.nome} — atualizado para ${statusLabel(status)}.`,
          priority: status === "cancelado" ? "alta" : "media",
        });

        logger.info(`${updated.numero}: ${order.status} → ${status}`, {
          kind: "order.status",
          orderId: id,
          by,
        });

        emit("order.status.changed", {
          orderId: id,
          numero: updated.numero,
          from: order.status,
          to: status,
          by,
        });
        if (status === "cancelado") {
          emit("order.cancelled", { orderId: id, numero: updated.numero, by });
        }
      },
    );
  } finally {
    inFlight.delete(id);
  }
}
