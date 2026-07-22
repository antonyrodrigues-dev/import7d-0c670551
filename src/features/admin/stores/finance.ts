import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FinanceMetrics, FinancePeriod } from "../types";

interface FinanceStore {
  metrics: FinanceMetrics | null;
  period: FinancePeriod;
  setPeriod: (p: FinancePeriod) => void;
  set: (m: FinanceMetrics) => void;
}

/**
 * Só o filtro de período é persistido — as métricas SÃO derivadas dos
 * pedidos em cada render (fonte única = orders.service).
 */
export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set) => ({
      metrics: null,
      period: "30d",
      setPeriod: (period) => set({ period }),
      set: (metrics) => set({ metrics }),
    }),
    {
      name: "7d-admin-finance-ui",
      partialize: (s) => ({ period: s.period }),
    },
  ),
);