import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminSettings } from "../types";
import { loadDefaultSettings } from "../services/settings.service";

interface SettingsStore {
  settings: AdminSettings;
  dirty: boolean;
  patch: (partial: Partial<AdminSettings>) => void;
  /** Marca o estado atual como salvo. Não altera valores. */
  commit: () => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: loadDefaultSettings(),
      dirty: false,
      patch: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial }, dirty: true })),
      commit: () => set({ dirty: false }),
      reset: () => set({ settings: loadDefaultSettings(), dirty: false }),
    }),
    {
      // v2 — mesma forma de `AdminSettings`, mas com sanitização garantida.
      // A migração preserva TODOS os campos válidos da v1 (mesmo shape) —
      // apenas completa com defaults quando algo estiver ausente.
      name: "7d-admin-settings",
      version: 2,
      migrate: (persisted) => {
        const defaults = loadDefaultSettings();
        const prev =
          persisted && typeof persisted === "object" && "settings" in persisted
            ? ((persisted as { settings?: Partial<AdminSettings> }).settings ?? {})
            : {};
        return {
          settings: { ...defaults, ...prev } as AdminSettings,
          dirty: false,
        };
      },
    },
  ),
);