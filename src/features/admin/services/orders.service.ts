/**
 * Serviço de pedidos administrativos — camada única entre stores/UI e o
 * dataSource. Não conhece qual backend está por trás; delega ao adapter.
 */

import { adminDataSource } from "../adapters";
import type { OrdersPage, OrdersPageQuery } from "../adapters/types";
import type { AdminOrder, OrderStatus } from "../types";

import { useOrdersStore } from "../stores/orders";
import { useInventoryStore } from "../stores/inventory";
import { notify } from "./notifications.service";
import { validateStatusTransition } from "../lib/validators";
import { PAYMENT_ONLY_STATUSES } from "../lib/statusMachine";
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

/**
 * Página de pedidos resolvida no servidor: status, busca e contagem total.
 * É o caminho padrão da lista — `listOrders` fica para rotinas internas.
 */
export function listOrdersPage(query: OrdersPageQuery): Promise<OrdersPage> {
  return adminDataSource.listOrdersPage(query).catch((e) => {
    throw handleAdminError(e, "orders.service.listOrdersPage");
  });
}

/**
 * Ponto de entrada canônico para mudança de status.
 *
 * Delega a transição para a RPC atômica `transicionar_pedido` no banco —
 * que valida a máquina de estados, aplica consumo/estorno de estoque
 * (idempotente via `pedidos.consumo_aplicado`) e grava histórico numa
 * ÚNICA transação PostgreSQL. Se algo falha, nada persiste.
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
  if (PAYMENT_ONLY_STATUSES.includes(status)) {
    handleAdminError(
      createAdminError(
        "validation",
        "Confirmação de pagamento só pelo módulo financeiro do pedido.",
        "orders.service.transition",
      ),
      "orders.service.transition",
    );
    return;
  }
  if (status === "cancelado" && order.pagamentoEstado === "confirmado") {
    handleAdminError(
      createAdminError(
        "validation",
        "Pedido pago exige estorno: use “Cancelar com estorno”.",
        "orders.service.transition",
      ),
      "orders.service.transition",
    );
    return;
  }
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
        // 1) RPC única — status + estoque + histórico dentro de UMA transação.
        //    A regra de consumo/estorno vive no banco (fonte única):
        //    - consome apenas na PRIMEIRA entrada em separado/reservado
        //    - estorna apenas se `consumo_aplicado = true` e o pedido é cancelado
        //    - finalização NUNCA consome novamente
        // Responsável é resolvido no banco a partir de `auth.uid()` (fonte
        // canônica). `by` serve apenas para rótulo otimista na store.
        await adminDataSource.transitionOrder(id, status);

        // Refresh do estoque quando a transição pode ter mexido em variações.
        const touchesStock =
          status === "separado" || status === "reservado" || status === "cancelado";
        if (touchesStock) {
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

        // 4) Logs + eventos. A NOTIFICAÇÃO é emitida pelo Postgres
        // (trigger `notificar_pedido_evento`) e chega via Realtime: fonte
        // única, sem duplicar alerta no cliente.


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

/**
 * Cancelamento canônico de pedido PAGO: estorno no ledger + devolução de
 * estoque + status, tudo numa transação do banco (Admin Master).
 */
export async function cancelOrderWithRefund(id: string, motivo?: string): Promise<void> {
  if (inFlight.has(id)) return;
  inFlight.add(id);
  try {
    await adminDataSource.cancelOrderWithRefund(id, motivo);
    await useOrdersStore.getState().refresh();
    void useInventoryStore.getState().refresh();
    logger.security(`Pedido cancelado com estorno`, { orderId: id });
    emit("order.cancelled", { orderId: id, numero: id, by: undefined });
  } catch (e) {
    throw handleAdminError(e, "orders.service.cancelWithRefund");
  } finally {
    inFlight.delete(id);
  }
}

/**
 * Trilha imutável de eventos do pedido — leitura pura, sem cache em store:
 * é sempre o banco quem dita a verdade da auditoria.
 */
export function listOrderAudit(orderId: string) {
  return adminDataSource.listOrderEvents(orderId).catch((e) => {
    throw handleAdminError(e, "orders.service.listOrderAudit");
  });
}
