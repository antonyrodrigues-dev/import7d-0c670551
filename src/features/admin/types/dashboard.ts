/**
 * Métrica com tendência período-a-período. `deltaPct` = variação relativa
 * (ex.: +25 = 25% acima do período anterior). `direction` acompanha o sinal.
 */
export interface TrendInfo {
  deltaPct: number;
  direction: "up" | "down" | "flat";
  comparedTo: string;
}

export interface DashboardMetrics {
  pedidosHoje: number;
  pedidosPendentes: number;
  pedidosFinalizados: number;
  clientes: number;
  produtos: number;
  estoqueBaixo: number;
  reservasEmAndamento: number;
  ticketMedio: number;
  faturamentoDia: number;
  faturamentoMes: number;
  /** Tendência dos indicadores diários vs. dia anterior. */
  pedidosHojeTrend?: TrendInfo;
  faturamentoDiaTrend?: TrendInfo;
  /** Tendência do faturamento mensal vs. mês anterior. */
  faturamentoMesTrend?: TrendInfo;
  ticketMedioTrend?: TrendInfo;
  /** Timestamp ISO de quando o snapshot foi calculado. */
  atualizadoEm: string;
}