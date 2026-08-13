/**
 * 7D IMPORTS — Máquina de estados oficial do pedido.
 *
 * Fonte única para validar transições. Qualquer módulo que mude o status
 * de um pedido DEVE consultar `canTransition` — nunca fazer bypass.
 */

import type { OrderStatus } from "../types";

/**
 * Espelho EXATO da tabela `public.pedido_transicoes` (autoridade final).
 * Qualquer divergência aqui é bug: o banco rejeita a transição de qualquer
 * forma — esta cópia existe apenas para a UI não oferecer ação impossível.
 */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  novo: ["whatsapp_declarado", "aguardando_atendimento", "em_atendimento", "cancelado"],
  whatsapp_declarado: ["aguardando_atendimento", "em_atendimento", "cancelado"],
  aguardando_atendimento: ["em_atendimento", "cancelado"],
  em_atendimento: ["aguardando_atendimento", "aguardando_pagamento", "cancelado"],
  aguardando_pagamento: ["pagamento_confirmado", "cancelado"],
  pagamento_confirmado: ["separado", "cancelado"],
  separado: ["reservado", "aguardando_retirada", "enviado", "cancelado"],
  reservado: ["aguardando_retirada", "enviado", "cancelado"],
  aguardando_retirada: ["finalizado", "cancelado"],
  enviado: ["finalizado", "cancelado"],
  // Finalizado só sai por devolução — a devolução tem fluxo próprio no banco
  // (`registrar_devolucao`); `transicionar_pedido` recusa este destino direto.
  finalizado: ["devolvido"],
  cancelado: [],
  devolvido: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}
