import { create } from "zustand";
import type { AsyncState, InventoryItem } from "../types";
import { listInventory } from "../services/inventory.service";

interface InventoryStore {
  state: AsyncState;
  items: InventoryItem[];
  query: string;
  filterBrand: string | "todas";
  filterCategory: string | "todas";
  filterStatus: "todos" | "ativos" | "inativos";
  setQuery: (q: string) => void;
  setFilterBrand: (b: string | "todas") => void;
  setFilterCategory: (c: string | "todas") => void;
  setFilterStatus: (s: "todos" | "ativos" | "inativos") => void;
  refresh: () => Promise<void>;
}

export const useInventoryStore = create<InventoryStore>((set) => ({
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
    const items = await listInventory();
    set({ items, state: "ready" });
  },
}));