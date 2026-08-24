/**
 * 7D IMPORTS — Serviço do Dashboard.
 *
 * AUTORIDADE FINANCEIRA: o ledger, via RPC `metricas_dashboard`.
 * Dashboard = Financeiro = ledger. Nenhum valor é recalculado no navegador
 * e o vendedor NÃO recebe métricas financeiras globais (o servidor omite).
 */

import { adminDataSource } from "../adapters";
import { toAdminError, type AdminError } from "../lib/errors";
import type { AdminDashboard } from "../types";

const num = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

/**
 * O banco devolve o offset curto ("+00"); o parser de datas do navegador
 * exige "+00:00". Normalizamos aqui, na borda, uma única vez.
 */
function normalizeIso(v: unknown): string {
  if (typeof v !== "string") return new Date().toISOString();
  const fixed = /[+-]\d{2}$/.test(v) ? `${v}:00` : v;
  const d = new Date(fixed);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function parseDashboard(raw: unknown): AdminDashboard {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    financeiroVisivel: Boolean(d.financeiroVisivel),
    receitaLiquidaDia: num(d.receitaLiquidaDia),
    receitaLiquidaMes: num(d.receitaLiquidaMes),
    vendasMes: num(d.vendasMes),
    ticketMedioMes: num(d.ticketMedioMes),
    pedidosHoje: num(d.pedidosHoje),
    pedidosEmAberto: num(d.pedidosEmAberto),
    atendimentosAguardando: num(d.atendimentosAguardando),
    atendimentosAtrasados: num(d.atendimentosAtrasados),
    pedidosComPendencia: num(d.pedidosComPendencia),
    pedidosFinalizados: num(d.pedidosFinalizados),
    clientes: num(d.clientes),
    produtos: num(d.produtos),
    estoqueBaixo: num(d.estoqueBaixo),
    pendenciasEstoque: num(d.pendenciasEstoque),
    atualizadoEm: normalizeIso(d.atualizadoEm),
  };
}

export interface DashboardResult {
  metrics: AdminDashboard | null;
  error: AdminError | null;
}

export async function fetchDashboard(): Promise<DashboardResult> {
  try {
    return { metrics: parseDashboard(await adminDataSource.dashboardMetrics()), error: null };
  } catch (e) {
    return { metrics: null, error: toAdminError(e, "dashboard.fetchDashboard") };
  }
}
