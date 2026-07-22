import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PublicProduct } from "@/features/catalog";
import { useCatalogStore } from "@/features/catalog";

const MAX_QTY = 10;
const clampQty = (n: number) => Math.max(1, Math.min(MAX_QTY, Math.floor(n) || 1));

export interface ReservaItem {
  slug: string;
  name: string;
  price: number;
  image: string;
  size: string;
  quantity: number;
}

interface ReservaState {
  items: ReservaItem[];
  open: boolean;
  searchOpen: boolean;
  addItem: (p: PublicProduct, size: string, qty: number) => void;
  removeItem: (slug: string, size: string) => void;
  updateQty: (slug: string, size: string, qty: number) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
}

export const useReserva = create<ReservaState>()(
  persist(
    (set) => ({
      items: [],
      open: false,
      searchOpen: false,
      addItem: (p, size, quantity) =>
        set((s) => {
          const q = clampQty(quantity);
          const idx = s.items.findIndex((i) => i.slug === p.slug && i.size === size);
          if (idx >= 0) {
            const next = [...s.items];
            next[idx] = { ...next[idx], quantity: clampQty(next[idx].quantity + q) };
            return { items: next, open: true };
          }
          return {
            items: [
              ...s.items,
              { slug: p.slug, name: p.name, price: p.price, image: p.image, size, quantity: q },
            ],
            open: true,
          };
        }),
      removeItem: (slug, size) =>
        set((s) => ({ items: s.items.filter((i) => !(i.slug === slug && i.size === size)) })),
      updateQty: (slug, size, quantity) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.slug === slug && i.size === size ? { ...i, quantity: clampQty(quantity) } : i,
          ),
        })),
      clear: () => set({ items: [] }),
      setOpen: (open) => set({ open }),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
    }),
    {
      name: "7d-reserva",
      partialize: (s) => ({ items: s.items }),
      // Sanitize persisted state on hydration: drop items whose product no
      // longer exists in the catalog, resync price/name/image to the current
      // catalog, and cap quantities. Prevents inconsistent state from a
      // stale localStorage after catalog updates.
      merge: (persisted, current) => {
        const p = (persisted as Partial<ReservaState> | undefined) ?? {};
        const raw = Array.isArray(p.items) ? (p.items as ReservaItem[]) : [];
        // Sanitiza contra o catálogo real quando já carregado; se ainda não
        // estiver disponível (primeira renderização), preserva o snapshot e
        // deixa a próxima interação corrigir divergências.
        const catalog = useCatalogStore.getState().products;
        const items: ReservaItem[] = [];
        for (const it of raw) {
          if (!it || typeof it !== "object") continue;
          const product = catalog.length ? catalog.find((pp) => pp.slug === it.slug) : null;
          if (product) {
            if (!product.sizes.includes(it.size)) continue;
            items.push({
              slug: product.slug,
              name: product.name,
              price: product.price,
              image: product.image,
              size: it.size,
              quantity: clampQty(Number(it.quantity) || 1),
            });
          } else {
            items.push({
              slug: String(it.slug ?? ""),
              name: String(it.name ?? ""),
              price: Number(it.price) || 0,
              image: String(it.image ?? ""),
              size: String(it.size ?? ""),
              quantity: clampQty(Number(it.quantity) || 1),
            });
          }
        }
        return { ...current, items };
      },
    },
  ),
);
