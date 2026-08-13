/**
 * 7D IMPORTS — Máquina canônica de pagamento.
 *
 * Espelho EXATO da tabela `pagamento_transicoes` (fonte da verdade no banco).
 * A UI usa este mapa apenas para habilitar/desabilitar ações; o servidor
 * revalida toda transição e recusa qualquer atalho.
 */

import type { PaymentState } from "../types";

export const PAYMENT_TRANSITIONS: Record<PaymentState, PaymentState[]> = {
  pendente: ["aguardando_comprovante", "em_analise", "confirmado", "recusado"],
  aguardando_comprovante: ["em_analise", "confirmado", "recusado", "pendente"],
  em_analise: ["confirmado", "recusado", "aguardando_comprovante"],
  recusado: ["aguardando_comprovante", "em_analise", "pendente"],
  confirmado: ["estornado"],
  estornado: [],
};

export function nextPaymentStates(atual: PaymentState): PaymentState[] {
  return PAYMENT_TRANSITIONS[atual] ?? [];
}

export function canTransitionPayment(de: PaymentState, para: PaymentState): boolean {
  return nextPaymentStates(de).includes(para);
}
