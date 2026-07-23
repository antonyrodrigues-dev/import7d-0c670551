import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import type { AsyncState, InventoryItem } from "../types";
import { listInventory } from "../services/inventory.service";
import { logEvent } from "./logs";

interface InventoryStore {
  state: AsyncState;
  items: InventoryItem[];
  query: string;
  filterBrand: string | "todas";
  filterCategory: string | "todas";
  filterStatus: "todos" | "ativos" | "inativos" | "baixo";
  setQuery: (q: string) => void;
  setFilterBrand: (b: string | "todas") => void;
  setFilterCategory: (c: string | "todas") => void;
  setFilterStatus: (s: "todos" | "ativos" | "inativos" | "baixo") => void;
  refresh: () => Promise<void>;
  /** Substitui a coleção. Uso restrito ao serviço. */
  replace: (items: InventoryItem[]) => void;
}

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set) => ({
      state: "idle",
      items: [],
      query: "",
      filterBrand: "todas",
      filterCategory: "todas",
      filterStatus: "todos",
      setQuery: (query) => set({ query }),
      setFilterBrand: (filterBrand) => set({ filterBrand }),
      setFilterCategory: (filterCategory) => set({ filterCategory }),
      setFilterStatus: (filterStatus) => set({ filterStatus }),
      refresh: async () => {
        set({ state: "loading" });
        try {
          const items = await listInventory();
          set({ items, state: "ready" });
        } catch (e) {
          const message = (e as Error).message ?? "Falha ao carregar estoque";
          set({ state: "error" as AsyncState });
          toast.error(message);
          logEvent("system.error", message);
        }
      },
      replace: (items) => set({ items }),
    }),
    {
      // v3 — Sprint 4/Onda 1: consumedOrderIds removido (idempotência agora
      // é responsabilidade do banco via `pedidos.consumo_aplicado`).
      name: "7d-admin-inventory",
      version: 3,
      migrate: () => ({
        query: "",
        filterBrand: "todas",
        filterCategory: "todas",
        filterStatus: "todos",
      }),
      partialize: (s) => ({
        query: s.query,
        filterBrand: s.filterBrand,
        filterCategory: s.filterCategory,
        filterStatus: s.filterStatus,
      }),
    },
  ),
);
