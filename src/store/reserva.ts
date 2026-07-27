import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PublicProduct } from "@/features/catalog";
import { useCatalogStore } from "@/features/catalog";

const MAX_QTY = 10;
const clampQty = (n: number, max = MAX_QTY) =>
  Math.max(1, Math.min(Math.max(1, max), Math.floor(n) || 1));

/** Teto real de um par produto/tamanho: menor entre MAX_QTY e o estoque. */
function stockCap(p: Pick<PublicProduct, "stockBySize">, size: string): number {
  return Math.min(MAX_QTY, p.stockBySize?.[size] ?? 0);
}

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
  /**
   * Reconcilia o carrinho persistido com o catálogo oficial: remove produtos
   * ou tamanhos inexistentes/esgotados e atualiza nome, imagem, preço e teto
   * de quantidade. Fonte única = catálogo do servidor.
   */
  syncWithCatalog: () => void;
}

export const useReserva = create<ReservaState>()(
  persist(
    (set) => ({
      items: [],
      open: false,
      searchOpen: false,
      addItem: (p, size, quantity) =>
        set((s) => {
          const cap = stockCap(p, size);
          if (!size || cap <= 0) return s;
          const q = clampQty(quantity, cap);
          const idx = s.items.findIndex((i) => i.slug === p.slug && i.size === size);
          if (idx >= 0) {
            const next = [...s.items];
            next[idx] = { ...next[idx], quantity: clampQty(next[idx].quantity + q, cap) };
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
        set((s) => {
          const product = useCatalogStore.getState().products.find((p) => p.slug === slug);
          const cap = product ? stockCap(product, size) : MAX_QTY;
          return {
            items: s.items.map((i) =>
              i.slug === slug && i.size === size
                ? { ...i, quantity: clampQty(quantity, cap || 1) }
                : i,
            ),
          };
        }),
      clear: () => set({ items: [] }),
      setOpen: (open) => set({ open }),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
      syncWithCatalog: () =>
        set((s) => {
          const catalog = useCatalogStore.getState().products;
          if (!catalog.length) return s;
          const items: ReservaItem[] = [];
          for (const it of s.items) {
            const product = catalog.find((p) => p.slug === it.slug);
            if (!product) continue;
            const cap = stockCap(product, it.size);
            if (cap <= 0) continue;
            items.push({
              slug: product.slug,
              name: product.name,
              price: product.price,
              image: product.image,
              size: it.size,
              quantity: clampQty(it.quantity, cap),
            });
          }
          const changed =
            items.length !== s.items.length ||
            items.some((it, i) => {
              const prev = s.items[i];
              return (
                prev.slug !== it.slug ||
                prev.size !== it.size ||
                prev.quantity !== it.quantity ||
                prev.price !== it.price ||
                prev.name !== it.name ||
                prev.image !== it.image
              );
            });
          return changed ? { items } : s;
        }),
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
