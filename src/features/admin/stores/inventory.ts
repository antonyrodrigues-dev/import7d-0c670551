import { create } from "zustand";
import type { AdminOrder, AsyncState, InventoryItem, StockEntry } from "../types";
import { listInventory } from "../services/inventory.service";

interface InventoryStore {
  state: AsyncState;
  items: InventoryItem[];
  query: string;
  filterBrand: string | "todas";
  filterCategory: string | "todas";
  filterStatus: "todos" | "ativos" | "inativos";
  /** Pedidos cujo consumo já foi aplicado ao estoque (garante idempotência). */
  consumedOrderIds: Record<string, true>;
  setQuery: (q: string) => void;
  setFilterBrand: (b: string | "todas") => void;
  setFilterCategory: (c: string | "todas") => void;
  setFilterStatus: (s: "todos" | "ativos" | "inativos") => void;
  refresh: () => Promise<void>;
  applyOrderConsumption: (order: AdminOrder) => void;
}

export const useInventoryStore = create<InventoryStore>((set, get) => ({
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
    const items = await listInventory();
    set({ items, state: "ready" });
  },
  applyOrderConsumption: (order) => {
    const { consumedOrderIds, items } = get();
    if (consumedOrderIds[order.id]) return;
    const nextItems = items.map((it) => {
      const consumido = order.itens.filter((oi) => oi.slug === it.slug);
      if (consumido.length === 0) return it;
      const nextStock: StockEntry[] = it.stockBySize.map((s) => {
        const dec = consumido
          .filter((c) => c.size === s.size)
          .reduce((a, c) => a + (c.quantity ?? 0), 0);
        return { ...s, quantity: Math.max(0, s.quantity - dec) };
      });
      return {
        ...it,
        stockBySize: nextStock,
        quantity: nextStock.reduce((a, s) => a + s.quantity, 0),
        atualizadoEm: new Date().toISOString(),
      };
    });
    set({ items: nextItems, consumedOrderIds: { ...consumedOrderIds, [order.id]: true } });
  },
}));