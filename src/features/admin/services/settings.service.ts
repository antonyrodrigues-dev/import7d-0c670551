import { BRAND, ATTENDANTS } from "@/config/attendants";
import { DEFAULT_PICKUP_HOURS } from "@/lib/pickup";
import { DEFAULT_INSTALLMENTS_CONFIG } from "@/lib/installments";
import { sanitizePhoneBR, sanitizeCEP, sanitizeInstagram } from "@/lib/masks";
import { fetchStoreSettingsRaw, saveStoreSettingsRaw } from "../adapters/settings.remote";
import type { AdminSettings, BusinessDayHours, PickupDaySlots, Weekday } from "../types";

/**
 * Horário oficial da loja (Seg–Sex 09h–18h · Sáb 10h–16h · Dom fechado).
 * Cada Weekday tem exatamente uma entrada; a UI nunca precisa criar/remover.
 */
function defaultBusinessHours(): BusinessDayHours[] {
  const weekdays: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
  return weekdays.map((weekday) => {
    if (weekday === 0) return { weekday, open: false, from: "09:00", to: "18:00" };
    if (weekday === 6) return { weekday, open: true, from: "10:00", to: "16:00" };
    return { weekday, open: true, from: "09:00", to: "18:00" };
  });
}

/** Slots default vindos da configuração antiga de retirada, indexados por dia. */
function defaultPickupSlots(): PickupDaySlots[] {
  const weekdays: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
  return weekdays.map((weekday) => {
    const found = DEFAULT_PICKUP_HOURS.days.find((d) => d.weekday === weekday);
    return { weekday, slots: found ? [...found.slots] : [] };
  });
}

/** Retorna as configurações operacionais atuais da loja. */
export function loadDefaultSettings(): AdminSettings {
  const attendant = ATTENDANTS[0];
  return {
    whatsapp: sanitizePhoneBR(attendant?.phone ?? ""),
    telefone: sanitizePhoneBR(BRAND.whatsapp.label),
    email: "",
    instagram: sanitizeInstagram(BRAND.instagram.handle),
    facebook: "",
    endereco: BRAND.address.line,
    cep: sanitizeCEP("95012-500"),
    cidade: "Caxias do Sul",
    businessHours: defaultBusinessHours(),
    pickupSlots: defaultPickupSlots(),
    parcelamentoMax: DEFAULT_INSTALLMENTS_CONFIG.maxInstallments,
    parcelaMinima: 30,
  };
}

/**
 * Normaliza um JSON vindo do banco para `AdminSettings`, completando com os
 * defaults oficiais. Nenhum campo desconhecido entra no domínio.
 */
export function normalizeSettings(raw: Record<string, unknown> | null): AdminSettings {
  const defaults = loadDefaultSettings();
  if (!raw) return defaults;
  const pickString = (key: keyof AdminSettings, fallback: string) => {
    const v = raw[key as string];
    return typeof v === "string" ? v : fallback;
  };
  const pickNumber = (key: keyof AdminSettings, fallback: number) => {
    const v = raw[key as string];
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  };
  const weekdays: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
  const rawHours = Array.isArray(raw.businessHours)
    ? (raw.businessHours as Partial<BusinessDayHours>[])
    : [];
  const rawSlots = Array.isArray(raw.pickupSlots)
    ? (raw.pickupSlots as Partial<PickupDaySlots>[])
    : [];

  return {
    whatsapp: sanitizePhoneBR(pickString("whatsapp", defaults.whatsapp)),
    telefone: sanitizePhoneBR(pickString("telefone", defaults.telefone)),
    email: pickString("email", defaults.email),
    instagram: sanitizeInstagram(pickString("instagram", defaults.instagram)),
    facebook: pickString("facebook", defaults.facebook),
    endereco: pickString("endereco", defaults.endereco),
    cep: sanitizeCEP(pickString("cep", defaults.cep)),
    cidade: pickString("cidade", defaults.cidade),
    businessHours: weekdays.map((weekday) => {
      const fallback = defaults.businessHours[weekday]!;
      const found = rawHours.find((h) => h?.weekday === weekday);
      return {
        weekday,
        open: typeof found?.open === "boolean" ? found.open : fallback.open,
        from: typeof found?.from === "string" ? found.from : fallback.from,
        to: typeof found?.to === "string" ? found.to : fallback.to,
      };
    }),
    pickupSlots: weekdays.map((weekday) => {
      const fallback = defaults.pickupSlots[weekday]!;
      const found = rawSlots.find((s) => s?.weekday === weekday);
      const slots = Array.isArray(found?.slots)
        ? found.slots.filter((t): t is string => typeof t === "string")
        : fallback.slots;
      return { weekday, slots: [...slots].sort() };
    }),
    parcelamentoMax: Math.min(12, Math.max(1, Math.round(pickNumber("parcelamentoMax", defaults.parcelamentoMax)))),
    parcelaMinima: Math.max(0, pickNumber("parcelaMinima", defaults.parcelaMinima)),
  };
}

/** Carrega as configurações oficiais do banco (fonte única da verdade). */
export async function loadStoreSettings(): Promise<AdminSettings> {
  const raw = await fetchStoreSettingsRaw();
  return normalizeSettings(raw);
}

/** Persiste as configurações no banco. O banco recusa quem não é Admin Master. */
export async function saveStoreSettings(settings: AdminSettings): Promise<AdminSettings> {
  const normalized = normalizeSettings(settings as unknown as Record<string, unknown>);
  await saveStoreSettingsRaw(normalized as unknown as Record<string, unknown>);
  return normalized;
}
