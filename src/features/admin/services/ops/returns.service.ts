/**
 * Serviço de devoluções e quarentena.
 *
 * A RPC `registrar_devolucao` é transacional e append-only: valida papel
 * (Admin Master), pedido finalizado, quantidade nunca maior que a vendida
 * (somando devoluções anteriores), devolve peça vendável ao saldo e envia
 * peça avariada para quarentena — tudo numa única transação.
 */

import { opsDataSource } from "../../adapters/ops";
import { createAdminError, handleAdminError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import type { ReturnInput, ReturnRecord } from "../../types";

export async function listReturns(pedidoId: string): Promise<ReturnRecord[]> {
  try {
    return await opsDataSource.listReturns(pedidoId);
  } catch (e) {
    handleAdminError(e, "returns.listReturns");
    return [];
  }
}

/** Condições físicas canônicas aceitas em NOVAS devoluções. */
const CANONICAL_CONDITIONS = ["vendavel", "usada", "avariada", "defeituosa"] as const;

/** Validação de entrada (o banco revalida tudo). */
export function validateReturn(input: ReturnInput): string | null {
  if (!input.pedidoId) return "Pedido inválido.";
  if (!input.motivo.trim()) return "Informe o motivo da devolução.";
  // Motivo "outro" é um rótulo, não uma descrição: exige texto próprio.
  if (input.motivo.trim().toLowerCase() === "outro")
    return "Descreva o motivo da devolução.";
  if (input.itens.length === 0) return "Selecione ao menos um item.";
  if (input.itens.some((i) => i.quantity <= 0)) return "Quantidade deve ser maior que zero.";
  if (input.itens.some((i) => !CANONICAL_CONDITIONS.includes(i.condicao)))
    return "Condição física inválida.";
  if (input.valorEstornado < 0) return "Valor estornado não pode ser negativo.";
  return null;
}

export async function registerReturn(input: ReturnInput): Promise<string | null> {
  const invalid = validateReturn(input);
  if (invalid) {
    handleAdminError(
      createAdminError("validation", invalid, "returns.registerReturn"),
      "returns.registerReturn",
    );
    return null;
  }
  try {
    const id = await opsDataSource.registerReturn(input);
    logger.info("Devolução registrada.", { pedidoId: input.pedidoId, origin: "returns.service" });
    return id;
  } catch (e) {
    handleAdminError(e, "returns.registerReturn");
    return null;
  }
}
