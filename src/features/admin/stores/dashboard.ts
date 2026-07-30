import { create } from "zustand";
import type { DashboardMetrics } from "../types";

interface DashboardStore {
  metrics: DashboardMetrics | null;
  loading: boolean;
  set: (m: DashboardMetrics) => void;
  setLoading: (v: boolean) => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  metrics: null,
  loading: false,
  set: (metrics) => set({ metrics, loading: false }),
  setLoading: (loading) => set({ loading }),
}));
