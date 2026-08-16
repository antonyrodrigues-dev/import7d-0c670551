/**
 * 7D IMPORTS — Frete oficial do pedido.
 *
 * O valor do frete NUNCA compõe o total pelo frontend: a RPC
 * `definir_frete_pedido` recalcula `valor_total` a partir do subtotal
 * oficial gravado no pedido e registra o evento na trilha imutável.
 * Exclusivo do Admin Master (validado no banco) e bloqueado após a
 * confirmação do pagamento.
 */

import { opsDataSource } from "../../adapters/ops";
import { handleAdminError } from "../../lib/errors";
import { logger } from "../../lib/logger";

export async function setShippingCost(pedidoId: string, valor: number): Promise<boolean> {
  if (!Number.isFinite(valor) || valor < 0) {
    handleAdminError(new Error("Valor de frete inválido."), "shipping.setShippingCost");
    return false;
  }
  try {
    await opsDataSource.setShippingCost(pedidoId, Math.round(valor * 100) / 100);
    logger.info("Frete definido.", { pedidoId, valor, origin: "shipping.service" });
    return true;
  } catch (e) {
    handleAdminError(e, "shipping.setShippingCost");
    return false;
  }
}