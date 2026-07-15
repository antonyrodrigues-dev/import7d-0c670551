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
  /** Pedidos cujo consumo já foi aplicado (idempotência local). */
  consumedOrderIds: Record<string, true>;
  setQuery: (q: string) => void;
  setFilterBrand: (b: string | "todas") => void;
  setFilterCategory: (c: string | "todas") => void;
  setFilterStatus: (s: "todos" | "ativos" | "inativos" | "baixo") => void;
  refresh: () => Promise<void>;
  markConsumed: (orderId: string) => void;
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
      consumedOrderIds: {},
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
      markConsumed: (orderId) =>
        set((s) => ({ consumedOrderIds: { ...s.consumedOrderIds, [orderId]: true } })),
      replace: (items) => set({ items }),
    }),
    {
      // v2 — schema real: só persistimos UI/idempotência, itens vêm sempre do backend.
      name: "7d-admin-inventory",
      version: 2,
      migrate: () => ({
        query: "",
        filterBrand: "todas",
        filterCategory: "todas",
        filterStatus: "todos",
        consumedOrderIds: {},
      }),
      partialize: (s) => ({
        query: s.query,
        filterBrand: s.filterBrand,
        filterCategory: s.filterCategory,
        filterStatus: s.filterStatus,
        consumedOrderIds: s.consumedOrderIds,
      }),
    },
  ),
);
