import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminSettings } from "../types";
import { loadDefaultSettings } from "../services/settings.service";

interface SettingsStore {
  settings: AdminSettings;
  dirty: boolean;
  patch: (partial: Partial<AdminSettings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: loadDefaultSettings(),
      dirty: false,
      patch: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial }, dirty: true })),
      reset: () => set({ settings: loadDefaultSettings(), dirty: false }),
    }),
    {
      // v2 — nova forma estruturada (businessHours/pickupSlots + campos sanitizados).
      name: "7d-admin-settings",
      version: 2,
      migrate: () => ({ settings: loadDefaultSettings(), dirty: false }),
    },
  ),
);