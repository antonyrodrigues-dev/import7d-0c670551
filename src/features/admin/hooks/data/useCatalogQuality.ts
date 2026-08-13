import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getCatalogSummary, listCatalogDiagnostics } from "../../services/catalogQuality.service";
import type { CatalogDiagnostic, CatalogQualitySummary } from "../../types";
import type { AdminAsyncState } from "../../types";

export function useCatalogQuality() {
  const [items, setItems] = useState<CatalogDiagnostic[]>([]);
  const [summary, setSummary] = useState<CatalogQualitySummary | null>(null);
  const [state, setState] = useState<AdminAsyncState>("loading");

  const refresh = useCallback(async () => {
    setState("loading");
    try {
      const [list, sum] = await Promise.all([listCatalogDiagnostics(), getCatalogSummary()]);
      setItems(list);
      setSummary(sum);
      setState("ready");
    } catch (e) {
      setState("error");
      toast.error((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, summary, state, refresh };
}
