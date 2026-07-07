import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminCustomer, AsyncState } from "../types";

interface CustomersStore {
  state: AsyncState;
  customers: AdminCustomer[];
  query: string;
  sortBy: "valor" | "recente" | "nome";
  setQuery: (q: string) => void;
  setSortBy: (s: "valor" | "recente" | "nome") => void;
  set: (customers: AdminCustomer[]) => void;
}

export const useCustomersStore = create<CustomersStore>()(
  persist(
    (set) => ({
      state: "idle",
      customers: [],
      query: "",
      sortBy: "valor",
      setQuery: (query) => set({ query }),
      setSortBy: (sortBy) => set({ sortBy }),
      set: (customers) => set({ customers, state: "ready" }),
    }),
    {
      name: "7d-admin-customers-ui",
      partialize: (s) => ({ query: s.query, sortBy: s.sortBy }),
    },
  ),
);
