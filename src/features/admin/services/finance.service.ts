/**
 * Serviço Financeiro — deriva TODOS os indicadores executivos exclusivamente
 * dos pedidos (fonte única: orders.service). Nunca consulta banco em paralelo,
 * nunca recalcula valores fora daqui.
 *
 * Regra de negócio: apenas pedidos `finalizado` compõem receita/ticket médio;
 * `cancelado` entra apenas em taxa de cancelamento.
 */

import type {
  AdminOrder,
  FinanceAttendantRank,
  FinanceMetrics,
  FinancePaymentSlice,
  FinancePeriod,
  FinanceProductRank,
  FinanceSeriesPoint,
} from "../types";

function periodStart(period: FinancePeriod, now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  switch (period) {
    case "7d":
      d.setDate(d.getDate() - 6);
      return d;
    case "30d":
      d.setDate(d.getDate() - 29);
      return d;
    case "90d":
      d.setDate(d.getDate() - 89);
      return d;
    case "ano":
      return new Date(now.getFullYear(), 0, 1);
    case "todos":
    default:
      return new Date(0);
  }
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function buildSeries(orders: AdminOrder[], start: Date, end: Date): FinanceSeriesPoint[] {
  const bucket = new Map<string, { receita: number; pedidos: number }>();
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    bucket.set(isoDay(d), { receita: 0, pedidos: 0 });
  }
  for (const o of orders) {
    const key = isoDay(new Date(o.criadoEm));
    const entry = bucket.get(key);
    if (!entry) continue;
    entry.receita += o.valorTotal;
    entry.pedidos += 1;
  }
  return Array.from(bucket.entries()).map(([date, v]) => ({
    date,
    label: shortLabel(date),
    receita: Math.round(v.receita * 100) / 100,
    pedidos: v.pedidos,
    ticketMedio: v.pedidos ? Math.round((v.receita / v.pedidos) * 100) / 100 : 0,
  }));
}

function topProdutos(orders: AdminOrder[], limit = 5): FinanceProductRank[] {
  const map = new Map<string, FinanceProductRank>();
  for (const o of orders) {
    for (const item of o.itens) {
      const cur = map.get(item.slug) ?? {
        slug: item.slug,
        name: item.name,
        quantidade: 0,
        receita: 0,
      };
      cur.quantidade += item.quantity;
      cur.receita += item.price * item.quantity;
      map.set(item.slug, cur);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.receita - a.receita)
    .slice(0, limit);
}

function topAtendentes(orders: AdminOrder[], limit = 5): FinanceAttendantRank[] {
  const map = new Map<string, FinanceAttendantRank>();
  for (const o of orders) {
    const nome = (o.responsavel ?? "Sem responsável").trim() || "Sem responsável";
    const cur = map.get(nome) ?? { nome, pedidos: 0, receita: 0 };
    cur.pedidos += 1;
    cur.receita += o.valorTotal;
    map.set(nome, cur);
  }
  return Array.from(map.values())
    .sort((a, b) => b.receita - a.receita)
    .slice(0, limit);
}

function pagamentos(orders: AdminOrder[]): FinancePaymentSlice[] {
  const map = new Map<string, FinancePaymentSlice>();
  for (const o of orders) {
    const metodo = o.pagamento.metodo || "—";
    const cur = map.get(metodo) ?? { metodo, pedidos: 0, receita: 0 };
    cur.pedidos += 1;
    cur.receita += o.valorTotal;
    map.set(metodo, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.receita - a.receita);
}

/** Constrói o snapshot financeiro para o período informado. */
export function buildFinanceMetrics(orders: AdminOrder[], period: FinancePeriod): FinanceMetrics {
  const now = new Date();
  const start = periodStart(period, now);
  const finalizados = orders.filter((o) => o.status === "finalizado");
  const cancelados = orders.filter((o) => o.status === "cancelado");

  const finalizadosPeriodo = finalizados.filter(
    (o) => new Date(o.criadoEm).getTime() >= start.getTime(),
  );

  const receitaPeriodo = finalizadosPeriodo.reduce((s, o) => s + o.valorTotal, 0);
  const ticketMedioPeriodo = finalizadosPeriodo.length
    ? receitaPeriodo / finalizadosPeriodo.length
    : 0;

  const todayKey = isoDay(now);
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearKey = String(now.getFullYear());

  const receitaDia = finalizados
    .filter((o) => isoDay(new Date(o.criadoEm)) === todayKey)
    .reduce((s, o) => s + o.valorTotal, 0);
  const receitaMes = finalizados
    .filter((o) => isoDay(new Date(o.criadoEm)).startsWith(monthKey))
    .reduce((s, o) => s + o.valorTotal, 0);
  const receitaAno = finalizados
    .filter((o) => isoDay(new Date(o.criadoEm)).startsWith(yearKey))
    .reduce((s, o) => s + o.valorTotal, 0);

  const totalDecisoes = finalizados.length + cancelados.length;
  const taxaCancelamentoPct = totalDecisoes
    ? Math.round((cancelados.length / totalDecisoes) * 1000) / 10
    : 0;

  return {
    periodo: period,
    receitaDia,
    receitaMes,
    receitaAno,
    receitaPeriodo,
    ticketMedioPeriodo,
    pedidosFinalizados: finalizadosPeriodo.length,
    pedidosCancelados: cancelados.filter((o) => new Date(o.criadoEm).getTime() >= start.getTime())
      .length,
    taxaCancelamentoPct,
    series: period === "todos" ? [] : buildSeries(finalizadosPeriodo, start, now),
    topProdutos: topProdutos(finalizadosPeriodo),
    topAtendentes: topAtendentes(finalizadosPeriodo),
    pagamentos: pagamentos(finalizadosPeriodo),
    atualizadoEm: now.toISOString(),
  };
}
