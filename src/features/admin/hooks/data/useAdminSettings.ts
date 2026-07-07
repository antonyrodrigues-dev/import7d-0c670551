import { useSettingsStore } from "../../stores/settings";

export function useAdminSettings() {
  return useSettingsStore();
}
