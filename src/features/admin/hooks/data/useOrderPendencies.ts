import { useCallback, useState } from "react";
import { toast } from "sonner";
import { resolvePendencies } from "../../services/ops/pendencies.service";
import { useOrdersStore } from "../../stores/orders";
import type { AdminAsyncState, PendencyItemInput } from "../../types";

/**
 * Resolução de pendências de preço/tamanho de um pedido. Após sucesso, a
 * store de pedidos é recarregada — nenhum componente ajusta o pedido local.
 */
export function useOrderPendencies(pedidoId: string | null) {
  const [state, setState] = useState<AdminAsyncState>("idle");
  const refreshOrders = useOrdersStore((s) => s.refresh);

  const resolver = useCallback(
    async (itens: PendencyItemInput[], motivoPreco?: string) => {
      if (!pedidoId) return false;
      setState("saving");
      const ok = await resolvePendencies(pedidoId, itens, motivoPreco);
      if (ok) {
        toast.success("Pendências resolvidas. Total do pedido recalculado.");
        await refreshOrders();
      }
      setState(ok ? "ready" : "error");
      return ok;
    },
    [pedidoId, refreshOrders],
  );

  return { state, resolver };
}
