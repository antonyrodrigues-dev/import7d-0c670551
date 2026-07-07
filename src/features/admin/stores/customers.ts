import { create } from "zustand";
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

export const useCustomersStore = create<CustomersStore>((set) => ({
  state: "idle",
  customers: [],
  query: "",
  sortBy: "valor",
  setQuery: (query) => set({ query }),
  setSortBy: (sortBy) => set({ sortBy }),
  set: (customers) => set({ customers, state: "ready" }),
}));