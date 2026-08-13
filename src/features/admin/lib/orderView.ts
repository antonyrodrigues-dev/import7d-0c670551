/**
 * 7D IMPORTS — Camada de apresentação dos pedidos.
 *
 * Fonte única de rótulos, tons, abas, agrupamentos e formatação temporal do
 * módulo de Pedidos. Nenhum componente pode recriar essas regras: Dashboard,
 * Pedidos e Atendimentos consomem exatamente os mesmos helpers.
 *
 * Aqui NÃO existe regra de negócio: transições continuam em `statusMachine`
 * e a autoridade final é sempre o banco.
 */

import { ORDER_STATUSES } from "../constants";
import { PAYMENT_STATES } from "../types";
import type { AdminOrder, OrderStatus, PaymentState } from "../types";

/** Fuso oficial da operação. Todo horário exibido usa este fuso. */
export const OFFICIAL_TZ = "America/Sao_Paulo";

export type BadgeTone = "neutral" | "info" | "warn" | "success" | "danger";

/** Abas operacionais da central de pedidos. */
export type OrdersTabKey =
  | "todos"
  | "novo"
  | "atendimento"
  | "pagamento_confirmado"
  | "em_separacao"
  | "a_caminho"
  | "finalizado"
  | "cancelado";

export interface OrdersTab {
  key: OrdersTabKey;
  label: string;
  /** Status oficiais cobertos pela aba (vazio = todos). */
  statuses: OrderStatus[];
}

export const ORDERS_TABS: OrdersTab[] = [
  { key: "todos", label: "Todos", statuses: [] },
  { key: "novo", label: "Novos", statuses: ["novo", "whatsapp_declarado"] },
  {
    key: "atendimento",
    label: "Atendimento",
    statuses: ["aguardando_atendimento", "em_atendimento", "aguardando_pagamento"],
  },
  {
    key: "pagamento_confirmado",
    label: "Pagamento confirmado",
    statuses: ["pagamento_confirmado"],
  },
  { key: "em_separacao", label: "Em separação", statuses: ["separado", "reservado"] },
  {
    key: "a_caminho",
    label: "Retirada e envio",
    statuses: ["aguardando_retirada", "enviado"],
  },
  { key: "finalizado", label: "Finalizados", statuses: ["finalizado", "devolvido"] },
  { key: "cancelado", label: "Cancelados", statuses: ["cancelado"] },
];

/** Pipeline em andamento — espelha a definição usada pelo Dashboard. */
export const PENDING_STATUSES: OrderStatus[] = [
  "novo",
  "whatsapp_declarado",
  "aguardando_atendimento",
  "em_atendimento",
  "aguardando_pagamento",
  "pagamento_confirmado",
  "separado",
  "reservado",
  "aguardando_retirada",
  "enviado",
];

export function isPending(order: AdminOrder): boolean {
  return PENDING_STATUSES.includes(order.status);
}

export function matchesTab(order: AdminOrder, tab: OrdersTabKey): boolean {
  const def = ORDERS_TABS.find((t) => t.key === tab);
  if (!def || def.statuses.length === 0) return true;
  return def.statuses.includes(order.status);
}

export function countByTab(orders: AdminOrder[]): Record<OrdersTabKey, number> {
  const out = {} as Record<OrdersTabKey, number>;
  for (const tab of ORDERS_TABS) {
    out[tab.key] =
      tab.statuses.length === 0
        ? orders.length
        : orders.filter((o) => tab.statuses.includes(o.status)).length;
  }
  return out;
}

/** Rótulo humano do status. Status desconhecido aparece cru, nunca como "Novo". */
export function statusLabel(status: OrderStatus | string): string {
  return ORDER_STATUSES.find((s) => s.key === status)?.label ?? String(status);
}

export function statusTone(status: OrderStatus | string): BadgeTone {
  switch (status) {
    case "novo":
    case "whatsapp_declarado":
      return "info";
    case "aguardando_atendimento":
    case "aguardando_pagamento":
      return "warn";
    case "em_atendimento":
      return "info";
    case "pagamento_confirmado":
      return "success";
    case "separado":
    case "reservado":
      return "warn";
    case "aguardando_retirada":
    case "enviado":
      return "info";
    case "finalizado":
      return "success";
    case "cancelado":
      return "danger";
    case "devolvido":
      return "danger";
    default:
      return "neutral";
  }
}

export function paymentLabel(estado: PaymentState | string): string {
  return PAYMENT_STATES.find((p) => p.key === estado)?.label ?? String(estado);
}

export function paymentTone(estado: PaymentState | string): BadgeTone {
  switch (estado) {
    case "confirmado":
      return "success";
    case "em_analise":
    case "aguardando_comprovante":
      return "warn";
    case "recusado":
    case "estornado":
      return "danger";
    default:
      return "neutral";
  }
}

// ───────────────────────────── Datas (fuso oficial) ────────────────────────

export function formatDateTimeSP(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: OFFICIAL_TZ,
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function formatTimeSP(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: OFFICIAL_TZ,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

/** "há 12 min", "há 3 h", "há 2 d" — leitura operacional imediata. */
export function relativeFrom(iso: string, now: number = Date.now()): string {
  const diffMin = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(diffMin)) return "—";
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

/** Minutos aguardando desde a criação — usado para destacar atrasos. */
export function waitingMinutes(order: AdminOrder, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(order.criadoEm).getTime()) / 60000));
}

// ─────────────────────────────── Resumos ───────────────────────────────────

/** Resumo textual dos itens: "2× Polo Piquet Marfim (P) +1 item". */
export function itemsSummary(order: AdminOrder): string {
  if (order.itens.length === 0) return "Sem itens";
  const first = order.itens[0];
  const head = `${first.quantity}× ${first.name}${first.size ? ` (${first.size})` : ""}`;
  const rest = order.itens.length - 1;
  return rest > 0 ? `${head} +${rest} ${rest === 1 ? "item" : "itens"}` : head;
}

export function deliveryLabel(order: AdminOrder): string {
  return order.entrega === "entrega" ? "Entrega" : "Retirada";
}

/** Valor líquido do pedido (total − devolvido). */
export function netValue(order: AdminOrder): number {
  return Math.max(0, order.valorTotal - (order.valorDevolvido ?? 0));
}

/**
 * Sinaliza pedidos que exigem ação: parados há muito tempo no pipeline ou
 * com pagamento recusado. Usado por Dashboard e Pedidos com o mesmo critério.
 */
export const ATTENTION_MINUTES = 60;

export function needsAttention(order: AdminOrder, now: number = Date.now()): boolean {
  if (order.pagamentoEstado === "recusado") return true;
  if (!isPending(order)) return false;
  return waitingMinutes(order, now) >= ATTENTION_MINUTES;
}
