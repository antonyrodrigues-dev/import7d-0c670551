import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useQueueStore } from "../../stores/ops";
import {
  claimOrder,
  loadQueue,
  releaseOrder,
  transferOrder,
} from "../../services/ops/queue.service";
import { useOperationalParams } from "./useOperationalParams";
import { useOpsRealtime } from "./useOpsRealtime";

/**
 * Hook único da fila de atendimento: reconcilia reservas, carrega a fila,
 * mantém sincronia em tempo real e expõe as ações operacionais.
 */
export function useQueue() {
  const { state, fila, emAtendimento, atualizadoEm, setState, set } = useQueueStore();
  const { params } = useOperationalParams();

  const refresh = useCallback(async () => {
    setState((useQueueStore.getState().fila.length ? "ready" : "loading") as "loading" | "ready");
    try {
      const snap = await loadQueue(params);
      set(snap.fila, snap.emAtendimento);
    } catch {
      setState("error");
    }
  }, [params, set, setState]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime + tique de minuto (tempos de espera e expiração de reserva).
  useOpsRealtime(() => void refresh());
  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const assumir = useCallback(
    async (pedidoId: string) => {
      setState("saving");
      const ok = await claimOrder(pedidoId);
      if (ok) toast.success("Atendimento assumido.");
      await refresh();
      return ok;
    },
    [refresh, setState],
  );

  const transferir = useCallback(
    async (pedidoId: string, novoResponsavel: string, observacao?: string) => {
      setState("saving");
      const ok = await transferOrder(pedidoId, novoResponsavel, observacao);
      if (ok) toast.success("Atendimento transferido.");
      await refresh();
      return ok;
    },
    [refresh, setState],
  );

  const devolverParaFila = useCallback(
    async (pedidoId: string, observacao?: string) => {
      setState("saving");
      const ok = await releaseOrder(pedidoId, observacao);
      if (ok) toast.success("Pedido devolvido à fila.");
      await refresh();
      return ok;
    },
    [refresh, setState],
  );

  return {
    state,
    fila,
    emAtendimento,
    atualizadoEm,
    params,
    refresh,
    assumir,
    transferir,
    devolverParaFila,
  };
}
