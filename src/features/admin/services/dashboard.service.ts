/**
 * Serviço do Dashboard — deriva métricas dos serviços de domínio.
 * Isola completamente a UI da forma como as métricas são calculadas.
 */

import type { AdminOrder, DashboardMetrics, InventoryItem } from "../types";
import { LOW_STOCK_THRESHOLD } from "../constants";

export function buildDashboardMetrics(
  orders: AdminOrder[],
  inventory: InventoryItem[],
  customersCount: number,
): DashboardMetrics {
  const now = new Date();
  const isSameDay = (d: string) => {
    const x = new Date(d);
    return (
      x.getFullYear() === now.getFullYear() &&
      x.getMonth() === now.getMonth() &&
      x.getDate() === now.getDate()
    );
  };
  const isSameMonth = (d: string) => {
    const x = new Date(d);
    return x.getFullYear() === now.getFullYear() && x.getMonth() === now.getMonth();
  };

  const finalizados = orders.filter((o) => o.status === "finalizado");
  const pedidosHoje = orders.filter((o) => isSameDay(o.criadoEm)).length;
  const pedidosPendentes = orders.filter(
    (o) => o.status !== "finalizado" && o.status !== "cancelado",
  ).length;
  const faturamentoDia = finalizados
    .filter((o) => isSameDay(o.criadoEm))
    .reduce((a, o) => a + o.valorTotal, 0);
  const faturamentoMes = finalizados
    .filter((o) => isSameMonth(o.criadoEm))
    .reduce((a, o) => a + o.valorTotal, 0);
  const ticketMedio = finalizados.length
    ? finalizados.reduce((a, o) => a + o.valorTotal, 0) / finalizados.length
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
  };
}