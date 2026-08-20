import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminSettings } from "../types";
import {
  loadDefaultSettings,
  loadStoreSettings,
  saveStoreSettings,
} from "../services/settings.service";

interface SettingsStore {
  settings: AdminSettings;
  dirty: boolean;
  /** `true` depois da primeira leitura bem-sucedida do banco. */
  hydrated: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  patch: (partial: Partial<AdminSettings>) => void;
  /** Lê o registro oficial do banco. O localStorage é apenas cache offline. */
  hydrate: () => Promise<void>;
  /** Persiste no banco; só o Admin Master é aceito pelo servidor. */
  save: () => Promise<void>;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: loadDefaultSettings(),
      dirty: false,
      hydrated: false,
      loading: false,
      saving: false,
      error: null,
      patch: (partial) => set((s) => ({ settings: { ...s.settings, ...partial }, dirty: true })),
      hydrate: async () => {
        if (get().loading) return;
        set({ loading: true, error: null });
        try {
          const settings = await loadStoreSettings();
          // Edições não salvas do operador têm precedência sobre o cache remoto.
          if (get().dirty) {
            set({ hydrated: true, loading: false });
            return;
          }
          set({ settings, hydrated: true, loading: false });
        } catch (e) {
          set({ loading: false, error: (e as Error).message });
        }
      },
      save: async () => {
        set({ saving: true, error: null });
        try {
          const saved = await saveStoreSettings(get().settings);
          set({ settings: saved, dirty: false, saving: false, hydrated: true });
        } catch (e) {
          set({ saving: false, error: (e as Error).message });
          throw e;
        }
      },
      reset: () => set({ settings: loadDefaultSettings(), dirty: true }),
    }),
    {
      // v3 — cache local das configurações oficiais do banco.
      name: "7d-admin-settings",
      version: 3,
      partialize: (state) => ({ settings: state.settings }) as unknown as SettingsStore,
      migrate: (persisted) => {
        const defaults = loadDefaultSettings();
        const prev =
          persisted && typeof persisted === "object" && "settings" in persisted
            ? ((persisted as { settings?: Partial<AdminSettings> }).settings ?? {})
            : {};
        return {
          settings: { ...defaults, ...prev } as AdminSettings,
          dirty: false,
        } as unknown as SettingsStore;
      },
    },
  ),
);
