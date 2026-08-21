/**
 * 7D IMPORTS — Resolução de pendências do pedido (funil único).
 *
 * Peças adicionadas "sob consulta" (sem preço oficial ou sem tamanho
 * definido) chegam ao Admin como pendência. A RPC
 * `resolver_pendencias_pedido` é a ÚNICA fonte de verdade: valida catálogo,
 * reserva estoque atomicamente e recalcula o total oficial do pedido.
 * O frontend apenas coleta os valores informados pelo atendente.
 */

import { opsDataSource } from "../../adapters/ops";
import { handleAdminError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import type { PendencyItemInput } from "../../types";

export async function resolvePendencies(
  pedidoId: string,
  itens: PendencyItemInput[],
): Promise<boolean> {
  if (itens.length === 0) {
    handleAdminError(new Error("Pedido sem itens para resolver."), "pendencies.resolve");
    return false;
  }
  for (const it of itens) {
    if (!it.size.trim()) {
      handleAdminError(new Error("Defina o tamanho de todas as peças."), "pendencies.resolve");
      return false;
    }
    if (!Number.isFinite(it.price) || it.price <= 0) {
      handleAdminError(new Error("Defina um preço válido para todas as peças."), "pendencies.resolve");
      return false;
    }
  }
  try {
    await opsDataSource.resolvePendencies(
      pedidoId,
      itens.map((i) => ({ size: i.size.trim(), price: Math.round(i.price * 100) / 100 })),
    );
    logger.info("Pendências resolvidas.", { pedidoId, origin: "pendencies.service" });
    return true;
  } catch (e) {
    handleAdminError(e, "pendencies.resolve");
    return false;
  }
}
