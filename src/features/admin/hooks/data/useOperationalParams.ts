import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useParamsStore } from "../../stores/ops";
import {
  loadCheckoutBlocks,
  loadParams,
  saveParam,
  validateParam,
} from "../../services/ops/params.service";
import type { CheckoutBlock, OperationalParamKey } from "../../types";

/** Parâmetros operacionais — leitura para todos, escrita só para Admin Master. */
export function useOperationalParams() {
  const { state, params, setState, set } = useParamsStore();

  const refresh = useCallback(async () => {
    setState("loading");
    set(await loadParams());
  }, [set, setState]);

  useEffect(() => {
    if (state === "idle") void refresh();
  }, [state, refresh]);

  const save = useCallback(
    async (key: OperationalParamKey, value: number) => {
      setState("saving");
      const ok = await saveParam(key, value);
      if (ok) toast.success("Parâmetro atualizado.");
      await refresh();
      return ok;
    },
    [refresh, setState],
  );

  return { state, params, refresh, save, validate: validateParam };
}

/** Tentativas de checkout recusadas pela proteção anti-abuso (Admin Master). */
export function useCheckoutBlocks(limit = 50) {
  const [blocks, setBlocks] = useState<CheckoutBlock[] | null>(null);

  const refresh = useCallback(async () => {
    setBlocks(await loadCheckoutBlocks(limit));
  }, [limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { blocks, loading: blocks === null, refresh };
}
