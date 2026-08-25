/**
 * 7D IMPORTS — Serviço Financeiro.
 *
 * FONTE ÚNICA: a RPC `metricas_financeiras` (SECURITY DEFINER, restrita ao
 * Admin Master, fuso America/Sao_Paulo). Este serviço NÃO lê a tabela
 * `pedidos`, NÃO usa `listOrders()` e NÃO recalcula nada — apenas traduz o
 * payload oficial para o contrato tipado do painel.
 */

import { opsDataSource } from "../adapters/ops";
import { toAdminError, type AdminError } from "../lib/errors";
import type {
  FinanceAttendantRank,
  FinanceMetrics,
  FinancePaymentSlice,
  FinancePeriod,
  FinanceProductRank,
  FinanceSeriesPoint,
} from "../types";

type Dict = Record<string, unknown>;

const num = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

const list = (v: unknown): Dict[] => (Array.isArray(v) ? (v as Dict[]) : []);

/** Traduz o JSON oficial da RPC para `FinanceMetrics`. */
export function parseFinanceMetrics(raw: unknown, periodo: FinancePeriod): FinanceMetrics {
  const d = (raw && typeof raw === "object" ? raw : {}) as Dict;
  const liquido = num(d.receitaPeriodo);
  const devolvido = num(d.valorDevolvido);

  const series: FinanceSeriesPoint[] = list(d.series).map((s) => ({
    label: String(s.label ?? ""),
    receita: num(s.receita),
    pedidos: num(s.pedidos),
  }));

  // A RPC devolve `receitaBruta` no ranking de produtos (valor faturado antes
  // de devoluções). Ler `receita` aqui zerava a coluna inteira no painel.
  const topProdutos: FinanceProductRank[] = list(d.topProdutos).map((p) => ({
    name: String(p.name ?? "—"),
    unidades: num(p.unidades),
    receita: num(p.receitaBruta),
  }));

  const topAtendentes: FinanceAttendantRank[] = list(d.topAtendentes).map((a) => ({
    nome: String(a.nome ?? "Sem responsável"),
    pedidos: num(a.pedidos),
    receita: num(a.receita),
  }));

  const pagamentos: FinancePaymentSlice[] = list(d.pagamentos).map((p) => ({
    metodo: String(p.metodo ?? "—"),
    pedidos: num(p.pedidos),
    receita: num(p.receita),
  }));

  return {
    periodo,
    receitaDia: num(d.receitaDia),
    receitaMes: num(d.receitaMes),
    receitaAno: num(d.receitaAno),
    receitaPeriodo: liquido,
    receitaBrutaPeriodo: Math.round((liquido + devolvido) * 100) / 100,
    valorDevolvido: devolvido,
    ticketMedioPeriodo: num(d.ticketMedioPeriodo),
    pedidosFinalizados: num(d.pedidosFinalizados),
    pedidosCancelados: num(d.pedidosCancelados),
    taxaCancelamentoPct: num(d.taxaCancelamentoPct),
    series,
    topProdutos,
    topAtendentes,
    pagamentos,
    atualizadoEm: new Date().toISOString(),
  };
}

export interface FinanceResult {
  metrics: FinanceMetrics | null;
  error: AdminError | null;
}

/**
 * Busca o snapshot oficial. NÃO deve ser chamado sem confirmar o papel
 * `admin` antes — o hook faz esse gate e a RPC bloqueia no servidor.
 */
export async function fetchFinanceMetrics(periodo: FinancePeriod): Promise<FinanceResult> {
  try {
    const raw = await opsDataSource.financeMetrics(periodo);
    return { metrics: parseFinanceMetrics(raw, periodo), error: null };
  } catch (e) {
    // Erro silencioso na UI: o gate de permissão já explica o bloqueio.
    return { metrics: null, error: toAdminError(e, "finance.fetchFinanceMetrics") };
  }
}
