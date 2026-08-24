/**
 * 7D IMPORTS — Próxima ação do pedido (fonte única da operação diária).
 *
 * O backend preserva TODOS os estados técnicos para auditoria; a UI mostra
 * apenas UMA ação primária por estado, dentro do fluxo visual:
 *
 *   ATENDIMENTO → PAGAMENTO → SEPARAÇÃO → RETIRADA/ENVIO → FINALIZADO
 *
 * Nenhuma ação incompatível é exibida: enquanto houver pendência de preço ou
 * tamanho, ações financeiras somem e a única saída é confirmar os dados da
 * peça. Assim o funcionário nunca clica em algo que o banco vai recusar.
 */

import type { AdminOrder, OrderStatus } from "../types";
import { canTransition } from "./statusMachine";

export type PrimaryKind = "status" | "payment" | "pendency" | "none";
export type SecondaryKind = "cancel" | "refund" | "return" | "none";

export interface PrimaryAction {
  kind: PrimaryKind;
  label: string;
  /** Status alvo quando `kind === "status"`. */
  status?: OrderStatus;
  /** Texto curto explicando o efeito da ação. */
  hint?: string;
}

export interface SecondaryAction {
  kind: SecondaryKind;
  label: string;
  danger?: boolean;
}

export interface OrderActionPlan {
  primary: PrimaryAction | null;
  secondary: SecondaryAction | null;
  /** Pendências que bloqueiam qualquer ação financeira. */
  pendencies: string[];
  /** `true` quando o pedido está pronto para seguir para pagamento. */
  ready: boolean;
  /** Ações financeiras podem aparecer? */
  financeEnabled: boolean;
}

/** Etapas do fluxo visual — usada pela timeline enxuta. */
export const VISUAL_STAGES = [
  { key: "atendimento", label: "Atendimento" },
  { key: "pagamento", label: "Pagamento" },
  { key: "separacao", label: "Separação" },
  { key: "entrega", label: "Retirada/Envio" },
  { key: "finalizado", label: "Finalizado" },
] as const;

export type VisualStage = (typeof VISUAL_STAGES)[number]["key"];

const STAGE_BY_STATUS: Record<OrderStatus, VisualStage> = {
  novo: "atendimento",
  whatsapp_declarado: "atendimento",
  aguardando_atendimento: "atendimento",
  em_atendimento: "atendimento",
  aguardando_pagamento: "pagamento",
  pagamento_confirmado: "separacao",
  separado: "separacao",
  reservado: "separacao",
  aguardando_retirada: "entrega",
  enviado: "entrega",
  finalizado: "finalizado",
  cancelado: "finalizado",
  devolvido: "finalizado",
};

export function visualStage(status: OrderStatus): VisualStage {
  return STAGE_BY_STATUS[status] ?? "atendimento";
}

export function visualStageIndex(status: OrderStatus): number {
  return VISUAL_STAGES.findIndex((s) => s.key === visualStage(status));
}

/** Pendências abertas do pedido, em linguagem operacional. */
export function orderPendencies(order: AdminOrder): string[] {
  const out: string[] = [];
  if (order.pendenciaTamanho) out.push("Confirmar tamanho");
  if (order.pendenciaPreco) out.push("Confirmar preço");
  return out;
}

const PRE_PAYMENT: OrderStatus[] = [
  "novo",
  "whatsapp_declarado",
  "aguardando_atendimento",
  "em_atendimento",
  "aguardando_pagamento",
];

/**
 * Calcula o plano de ação do pedido. Só devolve status alcançáveis segundo a
 * máquina de estados — a UI nunca oferece transição que o banco recusaria.
 */
export function orderActionPlan(order: AdminOrder): OrderActionPlan {
  const pendencies = orderPendencies(order);
  const pago = order.pagamentoEstado === "confirmado";
  const bloqueado = pendencies.length > 0;
  const financeEnabled = !bloqueado;

  const status = (s: OrderStatus, label: string, hint?: string): PrimaryAction | null =>
    canTransition(order.status, s) ? { kind: "status", label, status: s, hint } : null;

  let primary: PrimaryAction | null = null;

  if (bloqueado && PRE_PAYMENT.includes(order.status)) {
    primary = {
      kind: "pendency",
      label: "Confirmar dados da peça",
      hint: "Resolva as pendências para liberar o pagamento.",
    };
  } else {
    switch (order.status) {
      case "novo":
      case "whatsapp_declarado":
      case "aguardando_atendimento":
        primary = status("em_atendimento", "Iniciar atendimento");
        break;
      case "em_atendimento":
        primary = status(
          "aguardando_pagamento",
          "Prosseguir para pagamento",
          "Dados da peça confirmados e estoque válido.",
        );
        break;
      case "aguardando_pagamento":
        primary = { kind: "payment", label: "Confirmar pagamento" };
        break;
      case "pagamento_confirmado":
        primary = status("separado", "Iniciar separação");
        break;
      case "separado":
      case "reservado":
        primary =
          order.entrega === "entrega"
            ? status("enviado", "Marcar como enviado")
            : status("aguardando_retirada", "Pronto para retirada");
        break;
      case "aguardando_retirada":
      case "enviado":
        primary = status("finalizado", "Finalizar pedido");
        break;
      default:
        primary = null;
    }
  }

  let secondary: SecondaryAction | null = null;
  if (order.status === "finalizado") {
    secondary = { kind: "return", label: "Registrar devolução" };
  } else if (order.status === "cancelado" || order.status === "devolvido") {
    secondary = null;
  } else if (pago) {
    secondary = { kind: "refund", label: "Cancelar e reembolsar", danger: true };
  } else if (canTransition(order.status, "cancelado")) {
    secondary = { kind: "cancel", label: "Cancelar pedido", danger: true };
  }

  return {
    primary,
    secondary,
    pendencies,
    ready: !bloqueado,
    financeEnabled,
  };
}
