import { useEffect } from "react";
import { useSettingsStore } from "../../stores/settings";

/**
 * Configurações da loja. Sempre hidrata a partir do banco (fonte única da
 * verdade) — o localStorage serve só como cache para a primeira pintura.
 */
export function useAdminSettings() {
  const store = useSettingsStore();
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return store;
}

/** Versão somente leitura usada pela vitrine/checkout público. */
export function useStoreSettings() {
  const settings = useSettingsStore((s) => s.settings);
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return settings;
}
