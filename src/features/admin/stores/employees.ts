import { create } from "zustand";
import type { AsyncState, Employee } from "../types";
import { listEmployees } from "../services/employees.service";

interface EmployeesStore {
  state: AsyncState;
  employees: Employee[];
  error: string | null;
  refresh: () => Promise<void>;
}

export const useEmployeesStore = create<EmployeesStore>((set) => ({
  state: "idle",
  employees: [],
  error: null,
  refresh: async () => {
    set({ state: "loading", error: null });
    try {
      const employees = await listEmployees();
      set({ employees, state: "ready" });
    } catch (e) {
      set({ state: "error", error: (e as Error).message });
    }
  },
}));
