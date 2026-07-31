/**
 * Serviço de pagamentos.
 *
 * O valor confirmado NUNCA vem do frontend: a RPC `registrar_pagamento`
 * grava sempre `pedidos.valor_total` (valor oficial). Confirmar e estornar
 * são exclusivos do Admin Master (validado no banco). A operação é
 * idempotente: repetir o mesmo estado não cria segundo registro.
 */

import { opsDataSource } from "../../adapters/ops";
import { handleAdminError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import type { PaymentEntry, PaymentInput, PaymentState } from "../../types";
import { PAYMENT_ADMIN_ONLY } from "../../types";

export async function listPayments(pedidoId: string): Promise<PaymentEntry[]> {
  try {
    return await opsDataSource.listPayments(pedidoId);
  } catch (e) {
    handleAdminError(e, "payments.listPayments");
    return [];
  }
}

export function requiresAdmin(estado: PaymentState): boolean {
  return PAYMENT_ADMIN_ONLY.includes(estado);
}

export async function registerPayment(input: PaymentInput): Promise<boolean> {
  try {
    await opsDataSource.registerPayment(input);
    logger.info("Pagamento registrado.", {
      pedidoId: input.pedidoId,
      estado: input.estado,
      origin: "payments.service",
    });
    return true;
  } catch (e) {
    handleAdminError(e, "payments.registerPayment");
    return false;
  }
}
