import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/data/products";

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
  addItem: (p: Product, size: string, qty: number) => void;
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
          const idx = s.items.findIndex((i) => i.slug === p.slug && i.size === size);
          if (idx >= 0) {
            const next = [...s.items];
            next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
            return { items: next, open: true };
          }
          return {
            items: [...s.items, { slug: p.slug, name: p.name, price: p.price, image: p.image, size, quantity }],
            open: true,
          };
        }),
      removeItem: (slug, size) =>
        set((s) => ({ items: s.items.filter((i) => !(i.slug === slug && i.size === size)) })),
      updateQty: (slug, size, quantity) =>
        set((s) => ({
          items: s.items.map((i) => (i.slug === slug && i.size === size ? { ...i, quantity: Math.max(1, quantity) } : i)),
        })),
      clear: () => set({ items: [] }),
      setOpen: (open) => set({ open }),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
    }),
    { name: "7d-reserva", partialize: (s) => ({ items: s.items }) },
  ),
);