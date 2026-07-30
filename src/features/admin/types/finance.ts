import type { IsoDateTime } from "./common";

/** Período usado por cards, gráficos e rankings do Financeiro. */
export type FinancePeriod = "7d" | "30d" | "90d" | "ano" | "todos";

/** Ponto agregado da série diária de faturamento. */
export interface FinanceSeriesPoint {
  /** ISO `YYYY-MM-DD`. */
  date: string;
  /** Rótulo curto para eixo X (dd/MM). */
  label: string;
  receita: number;
  pedidos: number;
  ticketMedio: number;
}

/** Ranking de produtos vendidos (agregado por slug). */
export interface FinanceProductRank {
  slug: string;
  name: string;
  quantidade: number;
  receita: number;
}

/** Ranking de atendentes por número/valor de pedidos finalizados. */
export interface FinanceAttendantRank {
  nome: string;
  pedidos: number;
  receita: number;
}

/** Agregação por método de pagamento. */
export interface FinancePaymentSlice {
  metodo: string;
  pedidos: number;
  receita: number;
}

/**
 * Snapshot financeiro derivado exclusivamente dos pedidos.
 * Apenas pedidos com status `finalizado` compõem receita/ticket médio.
 */
export interface FinanceMetrics {
  periodo: FinancePeriod;
  receitaDia: number;
  receitaMes: number;
  receitaAno: number;
  receitaPeriodo: number;
  ticketMedioPeriodo: number;
  pedidosFinalizados: number;
  pedidosCancelados: number;
  taxaCancelamentoPct: number;
  series: FinanceSeriesPoint[];
  topProdutos: FinanceProductRank[];
  topAtendentes: FinanceAttendantRank[];
  pagamentos: FinancePaymentSlice[];
  atualizadoEm: IsoDateTime;
}
