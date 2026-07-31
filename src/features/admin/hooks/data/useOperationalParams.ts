import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useParamsStore } from "../../stores/ops";
import { loadParams, saveParam, validateParam } from "../../services/ops/params.service";
import type { OperationalParamKey } from "../../types";

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
