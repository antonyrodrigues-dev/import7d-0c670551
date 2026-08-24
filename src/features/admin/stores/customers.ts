import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminAsyncState, AdminCustomer } from "../types";

interface CustomersStore {
  state: AdminAsyncState;
  customers: AdminCustomer[];
  total: number;
  page: number;
  query: string;
  setQuery: (q: string) => void;
  setPage: (p: number) => void;
  setState: (s: AdminAsyncState) => void;
  set: (customers: AdminCustomer[], total: number) => void;
}

/** Persistimos apenas estado de UI (busca). A lista vem sempre do servidor. */
export const useCustomersStore = create<CustomersStore>()(
  persist(
    (set) => ({
      state: "idle",
      customers: [],
      total: 0,
      page: 1,
      query: "",
      setQuery: (query) => set({ query, page: 1 }),
      setPage: (page) => set({ page }),
      setState: (state) => set({ state }),
      set: (customers, total) =>
        set({ customers, total, state: customers.length === 0 ? "empty" : "ready" }),
    }),
    {
      name: "7d-admin-customers-ui",
      partialize: (s) => ({ query: s.query }),
    },
  ),
);
