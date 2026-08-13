import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  addKitComponent,
  listKitComposition,
  removeKitComponent,
} from "../../services/kits.service";
import type { KitComponentWritePayload } from "../../adapters/types";
import type { AdminAsyncState, KitAvailability } from "../../types";

/** Composição de um kit + disponibilidade derivada das peças. */
export function useKitComposition(kitId: string | null) {
  const [sizes, setSizes] = useState<KitAvailability[]>([]);
  const [state, setState] = useState<AdminAsyncState>("loading");

  const refresh = useCallback(async () => {
    if (!kitId) {
      setSizes([]);
      setState("ready");
      return;
    }
    setState("loading");
    try {
      setSizes(await listKitComposition(kitId));
      setState("ready");
    } catch (e) {
      setState("error");
      toast.error((e as Error).message);
    }
  }, [kitId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (p: KitComponentWritePayload) => {
      try {
        await addKitComponent(p);
        toast.success("Peça adicionada à composição.");
        await refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!kitId) return;
      try {
        await removeKitComponent(id, kitId);
        toast.success("Peça removida da composição.");
        await refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [kitId, refresh],
  );

  return { sizes, state, refresh, add, remove };
}
