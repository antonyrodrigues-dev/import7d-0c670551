import { create } from "zustand";
import type { AdminAsyncState, AdminDashboard } from "../types";

interface DashboardStore {
  metrics: AdminDashboard | null;
  state: AdminAsyncState;
  error: string | null;
  set: (m: AdminDashboard) => void;
  setState: (s: AdminAsyncState, error?: string | null) => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  metrics: null,
  state: "idle",
  error: null,
  set: (metrics) => set({ metrics, state: "ready", error: null }),
  setState: (state, error = null) => set({ state, error }),
}));
