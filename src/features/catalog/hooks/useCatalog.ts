import { useEffect } from "react";
import { useCatalogStore } from "../stores/catalog";

/**
 * Hook público de leitura do catálogo. Dispara a carga inicial na primeira
 * montagem e devolve o estado reativo — os componentes do site consomem
 * apenas este hook.
 */
export function useCatalog() {
  const store = useCatalogStore();
  useEffect(() => {
    if (store.state === "idle") void store.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return store;
}