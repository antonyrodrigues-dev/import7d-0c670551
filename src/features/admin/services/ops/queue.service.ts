/**
 * Serviço da fila de atendimento.
 *
 * Regras de negócio (o banco é a autoridade final — aqui apenas orquestramos
 * reconciliação, cache e mensagens):
 * - antes de listar ou assumir, reconciliamos reservas expiradas;
 * - assumir é atômico no banco: dois vendedores nunca ficam com o mesmo pedido;
 * - vendedor não assume pedido de outro; só Admin Master transfere/devolve.
 */

import { opsDataSource } from "../../adapters/ops";
import { handleAdminError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import type { OperationalParams, QueueOrder } from "../../types";

export interface QueueSnapshot {
  fila: QueueOrder[];
  emAtendimento: QueueOrder[];
  reconciliadas: number;
}

export async function loadQueue(params: OperationalParams): Promise<QueueSnapshot> {
  const reconciliadas = await reconcileReservations();
  const { fila, emAtendimento } = await opsDataSource.listQueue(params);
  return { fila, emAtendimento, reconciliadas };
}

/** Reconciliação idempotente — segura para chamar em qualquer abertura de tela. */
export async function reconcileReservations(): Promise<number> {
  try {
    const n = await opsDataSource.reconcileReservations();
    if (n > 0) logger.info(`Reservas expiradas liberadas: ${n}`, { origin: "queue.service" });
    return n;
  } catch (e) {
    logger.warn("Falha ao reconciliar reservas.", { cause: e });
    return 0;
  }
}

export async function claimOrder(pedidoId: string): Promise<boolean> {
  try {
    await reconcileReservations();
    await opsDataSource.claimOrder(pedidoId);
    logger.info("Atendimento assumido.", { pedidoId, origin: "queue.service" });
    return true;
  } catch (e) {
    handleAdminError(e, "queue.claimOrder");
    return false;
  }
}

export async function transferOrder(
  pedidoId: string,
  novoResponsavel: string,
  observacao?: string,
): Promise<boolean> {
  try {
    await opsDataSource.transferOrder(pedidoId, novoResponsavel, observacao);
    logger.info("Atendimento transferido.", { pedidoId, origin: "queue.service" });
    return true;
  } catch (e) {
    handleAdminError(e, "queue.transferOrder");
    return false;
  }
}

export async function releaseOrder(pedidoId: string, observacao?: string): Promise<boolean> {
  try {
    await opsDataSource.releaseOrder(pedidoId, observacao);
    logger.info("Pedido devolvido à fila.", { pedidoId, origin: "queue.service" });
    return true;
  } catch (e) {
    handleAdminError(e, "queue.releaseOrder");
    return false;
  }
}
