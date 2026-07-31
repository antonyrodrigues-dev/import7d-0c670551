import type { IsoDateTime } from "./common";

/**
 * Contrato do Financeiro.
 *
 * TODOS os valores vêm da RPC `metricas_financeiras` (SECURITY DEFINER,
 * restrita ao Admin Master, timezone oficial America/Sao_Paulo). O frontend
 * NUNCA soma pedidos para produzir estes números.
 */

/** Período usado por cards, gráficos e rankings do Financeiro. */
export type FinancePeriod = "7d" | "30d" | "90d" | "ano" | "todos";

/** Ponto agregado da série diária de faturamento (já em fuso oficial). */
export interface FinanceSeriesPoint {
  /** Rótulo curto para eixo X (dd/MM), calculado no banco. */
  label: string;
  receita: number;
  pedidos: number;
}

/** Ranking de produtos vendidos. */
export interface FinanceProductRank {
  name: string;
  unidades: number;
  receita: number;
}

/** Ranking de atendentes por receita líquida. */
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
 * Snapshot financeiro oficial. Considera apenas pedidos com pagamento
 * `confirmado`; devoluções/estornos reduzem o líquido; cancelados e
 * recusados não entram na receita.
 */
export interface FinanceMetrics {
  periodo: FinancePeriod;
  receitaDia: number;
  receitaMes: number;
  receitaAno: number;
  /** Receita líquida do período (bruto − estornos). */
  receitaPeriodo: number;
  /** Receita bruta do período (antes de devoluções). */
  receitaBrutaPeriodo: number;
  /** Total estornado/devolvido no período. */
  valorDevolvido: number;
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
