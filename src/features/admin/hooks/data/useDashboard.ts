import { useCallback, useEffect } from "react";
import { useDashboardStore } from "../../stores/dashboard";
import { fetchDashboard } from "../../services/dashboard.service";
import { useOpsRealtime } from "./useOpsRealtime";
import { usePermissions } from "../usePermissions";

/**
 * Fluxo único de métricas: RPC `metricas_dashboard` → DashboardStore → cards.
 * Nenhum card calcula seus próprios valores e nenhum valor financeiro é
 * derivado dos pedidos no navegador.
 */
export function useDashboard() {
  const { ready } = usePermissions();
  const metrics = useDashboardStore((s) => s.metrics);
  const state = useDashboardStore((s) => s.state);
  const error = useDashboardStore((s) => s.error);
  const set = useDashboardStore((s) => s.set);
  const setState = useDashboardStore((s) => s.setState);

  const refresh = useCallback(async () => {
    setState("loading");
    const { metrics: m, error: e } = await fetchDashboard();
    if (m) set(m);
    else setState("error", e?.message ?? "Falha ao carregar o painel.");
  }, [set, setState]);

  useEffect(() => {
    if (ready) void refresh();
  }, [ready, refresh]);

  useOpsRealtime(() => void refresh(), ready);

  return { metrics, state, error, loading: state === "loading" && !metrics, refresh };
}
