import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import type { AdminOrder, AsyncState, InventoryItem, StockEntry } from "../types";
import { listInventory } from "../services/inventory.service";
import { validateStockChange } from "../lib/validators";
import { logEvent } from "./logs";

interface InventoryStore {
  state: AsyncState;
  items: InventoryItem[];
  query: string;
  filterBrand: string | "todas";
  filterCategory: string | "todas";
  filterStatus: "todos" | "ativos" | "inativos";
  /** Pedidos cujo consumo já foi aplicado ao estoque (idempotência). */
  consumedOrderIds: Record<string, true>;
  setQuery: (q: string) => void;
  setFilterBrand: (b: string | "todas") => void;
  setFilterCategory: (c: string | "todas") => void;
  setFilterStatus: (s: "todos" | "ativos" | "inativos") => void;
  refresh: () => Promise<void>;
  applyOrderConsumption: (order: AdminOrder) => void;
  /** Operações canônicas de estoque. */
  entrada: (slug: string, size: string, qty: number) => void;
  saida: (slug: string, size: string, qty: number) => void;
  ajuste: (slug: string, size: string, qty: number) => void;
  reposicao: (slug: string, size: string, qty: number) => void;
}

function applyDelta(
  items: InventoryItem[],
  slug: string,
  size: string,
  delta: number,
): InventoryItem[] {
  return items.map((it) => {
    if (it.slug !== slug) return it;
    const nextStock: StockEntry[] = it.stockBySize.map((s) =>
      s.size === size ? { ...s, quantity: Math.max(0, s.quantity + delta) } : s,
    );
    return {
      ...it,
      stockBySize: nextStock,
      quantity: nextStock.reduce((a, s) => a + s.quantity, 0),
      atualizadoEm: new Date().toISOString(),
    };
  });
}

function applyAbsolute(
  items: InventoryItem[],
  slug: string,
  size: string,
  qty: number,
): InventoryItem[] {
  return items.map((it) => {
    if (it.slug !== slug) return it;
    const nextStock: StockEntry[] = it.stockBySize.map((s) =>
      s.size === size ? { ...s, quantity: Math.max(0, qty) } : s,
    );
    return {
      ...it,
      stockBySize: nextStock,
      quantity: nextStock.reduce((a, s) => a + s.quantity, 0),
      atualizadoEm: new Date().toISOString(),
    };
  });
}

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set, get) => ({
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
        set({
          items: nextItems,
          consumedOrderIds: { ...consumedOrderIds, [order.id]: true },
        });
        logEvent("stock.out", `Consumo aplicado ao pedido ${order.numero}`, {
          orderId: order.id,
        });
      },
      entrada: (slug, size, qty) => {
        if (qty <= 0) return toast.error("Quantidade deve ser positiva.");
        set({ items: applyDelta(get().items, slug, size, qty) });
        logEvent("stock.in", `Entrada +${qty} em ${slug}/${size}`);
      },
      saida: (slug, size, qty) => {
        if (qty <= 0) return toast.error("Quantidade deve ser positiva.");
        const item = get().items.find((i) => i.slug === slug);
        if (!item) return toast.error("Produto inexistente.");
        const check = validateStockChange(item, size, -qty);
        if (!check.ok) {
          toast.error(check.errors[0] ?? "Estoque insuficiente.");
          return;
        }
        set({ items: applyDelta(get().items, slug, size, -qty) });
        logEvent("stock.out", `Saída -${qty} em ${slug}/${size}`);
      },
      ajuste: (slug, size, qty) => {
        set({ items: applyAbsolute(get().items, slug, size, qty) });
        logEvent("stock.adjust", `Ajuste ${slug}/${size} = ${qty}`);
      },
      reposicao: (slug, size, qty) => {
        if (qty <= 0) return toast.error("Quantidade deve ser positiva.");
        set({ items: applyDelta(get().items, slug, size, qty) });
        logEvent("stock.restock", `Reposição +${qty} em ${slug}/${size}`);
      },
    }),
    {
      name: "7d-admin-inventory",
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
