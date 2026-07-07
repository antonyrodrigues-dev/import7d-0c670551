/**
 * 7D IMPORTS — Máquina de estados oficial do pedido.
 *
 * Fonte única para validar transições. Qualquer módulo que mude o status
 * de um pedido DEVE consultar `canTransition` — nunca fazer bypass.
 */

import type { OrderStatus } from "../types";

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  novo: ["separado", "reservado", "cancelado"],
  separado: ["reservado", "aguardando_retirada", "enviado", "finalizado", "cancelado"],
  reservado: ["separado", "aguardando_retirada", "enviado", "finalizado", "cancelado"],
  aguardando_retirada: ["finalizado", "cancelado"],
  enviado: ["finalizado", "cancelado"],
  finalizado: [],
  cancelado: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}
