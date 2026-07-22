import { create } from "zustand";
import type { PublicProduct } from "../types";
import { listActiveProducts } from "../services/catalog.service";

type State = "idle" | "loading" | "ready" | "error";

interface CatalogStore {
  state: State;
  error: string | null;
  products: PublicProduct[];
  /** Timestamp da última carga bem-sucedida — usado por SWR e refresh manual. */
  loadedAt: number | null;
  refresh: () => Promise<void>;
}

/**
 * Store global do catálogo. NÃO persistida: produtos são fonte de verdade do
 * backend — persistir localmente criaria uma segunda verdade e mostraria
 * itens arquivados após um deploy do admin.
 */
export const useCatalogStore = create<CatalogStore>((set, get) => ({
  state: "idle",
  error: null,
  products: [],
  loadedAt: null,
  refresh: async () => {
    if (get().state === "loading") return;
    set({ state: "loading", error: null });
    try {
      const products = await listActiveProducts();
      set({ products, state: "ready", loadedAt: Date.now() });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao carregar catálogo";
      set({ state: "error", error: message });
    }
  },
}));