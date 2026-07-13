/**
 * Serviço do Dashboard — deriva métricas dos serviços de domínio.
 * Isola completamente a UI da forma como as métricas são calculadas.
 */

import type { AdminOrder, DashboardMetrics, InventoryItem, TrendInfo } from "../types";
import { LOW_STOCK_THRESHOLD } from "../constants";

function trendFrom(current: number, previous: number, comparedTo: string): TrendInfo {
  if (previous === 0 && current === 0) {
    return { deltaPct: 0, direction: "flat", comparedTo };
  }
  if (previous === 0) {
    return { deltaPct: 100, direction: "up", comparedTo };
  }
  const deltaPct = ((current - previous) / previous) * 100;
  const direction: TrendInfo["direction"] =
    Math.abs(deltaPct) < 1 ? "flat" : deltaPct > 0 ? "up" : "down";
  return { deltaPct: Math.round(deltaPct * 10) / 10, direction, comparedTo };
}

export function buildDashboardMetrics(
  orders: AdminOrder[],
  inventory: InventoryItem[],
  customersCount: number,
): DashboardMetrics {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const prevMonth = new Date(now);
  prevMonth.setMonth(now.getMonth() - 1);

  const isSameDay = (d: string) => {
    const x = new Date(d);
    return (
      x.getFullYear() === now.getFullYear() &&
      x.getMonth() === now.getMonth() &&
      x.getDate() === now.getDate()
    );
  };
  const isYesterday = (d: string) => {
    const x = new Date(d);
    return (
      x.getFullYear() === yesterday.getFullYear() &&
      x.getMonth() === yesterday.getMonth() &&
      x.getDate() === yesterday.getDate()
    );
  };
  const isSameMonth = (d: string) => {
    const x = new Date(d);
    return x.getFullYear() === now.getFullYear() && x.getMonth() === now.getMonth();
  };
  const isPrevMonth = (d: string) => {
    const x = new Date(d);
    return x.getFullYear() === prevMonth.getFullYear() && x.getMonth() === prevMonth.getMonth();
  };

  const finalizados = orders.filter((o) => o.status === "finalizado");
  const pedidosHoje = orders.filter((o) => isSameDay(o.criadoEm)).length;
  const pedidosOntem = orders.filter((o) => isYesterday(o.criadoEm)).length;
  const pedidosPendentes = orders.filter(
    (o) => o.status !== "finalizado" && o.status !== "cancelado",
  ).length;
  const faturamentoDia = finalizados
    .filter((o) => isSameDay(o.criadoEm))
    .reduce((a, o) => a + o.valorTotal, 0);
  const faturamentoOntem = finalizados
    .filter((o) => isYesterday(o.criadoEm))
    .reduce((a, o) => a + o.valorTotal, 0);
  const faturamentoMes = finalizados
    .filter((o) => isSameMonth(o.criadoEm))
    .reduce((a, o) => a + o.valorTotal, 0);
  const faturamentoMesAnterior = finalizados
    .filter((o) => isPrevMonth(o.criadoEm))
    .reduce((a, o) => a + o.valorTotal, 0);
  const finalizadosMes = finalizados.filter((o) => isSameMonth(o.criadoEm));
  const finalizadosMesAnterior = finalizados.filter((o) => isPrevMonth(o.criadoEm));
  const ticketMedio = finalizados.length
    ? finalizados.reduce((a, o) => a + o.valorTotal, 0) / finalizados.length
    : 0;
  const ticketMedioMes = finalizadosMes.length
    ? finalizadosMes.reduce((a, o) => a + o.valorTotal, 0) / finalizadosMes.length
    : 0;
  const ticketMedioMesAnterior = finalizadosMesAnterior.length
    ? finalizadosMesAnterior.reduce((a, o) => a + o.valorTotal, 0) / finalizadosMesAnterior.length
    : 0;

  return {
    pedidosHoje,
    pedidosPendentes,
    pedidosFinalizados: finalizados.length,
    clientes: customersCount,
    produtos: inventory.length,
    estoqueBaixo: inventory.filter((i) => i.quantity <= LOW_STOCK_THRESHOLD).length,
    reservasEmAndamento: orders.filter((o) => o.status === "reservado").length,
    ticketMedio,
    faturamentoDia,
    faturamentoMes,
    pedidosHojeTrend: trendFrom(pedidosHoje, pedidosOntem, "ontem"),
    faturamentoDiaTrend: trendFrom(faturamentoDia, faturamentoOntem, "ontem"),
    faturamentoMesTrend: trendFrom(faturamentoMes, faturamentoMesAnterior, "mês anterior"),
    ticketMedioTrend: trendFrom(ticketMedioMes, ticketMedioMesAnterior, "mês anterior"),
    atualizadoEm: now.toISOString(),
  };
}