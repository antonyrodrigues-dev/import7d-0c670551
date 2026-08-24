/**
 * Snapshot oficial do painel — calculado no servidor (`metricas_dashboard`).
 * Campos financeiros só vêm preenchidos para o Administrador Master;
 * `financeiroVisivel` diz se a UI pode exibi-los.
 */
export interface AdminDashboard {
  financeiroVisivel: boolean;
  receitaLiquidaDia: number;
  receitaLiquidaMes: number;
  vendasMes: number;
  ticketMedioMes: number;
  pedidosHoje: number;
  pedidosEmAberto: number;
  atendimentosAguardando: number;
  atendimentosAtrasados: number;
  pedidosComPendencia: number;
  pedidosFinalizados: number;
  clientes: number;
  produtos: number;
  estoqueBaixo: number;
  pendenciasEstoque: number;
  /** Timestamp ISO de quando o snapshot foi calculado pelo servidor. */
  atualizadoEm: string;
}
