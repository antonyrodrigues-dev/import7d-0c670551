import { BRAND, ATTENDANTS } from "@/config/attendants";
import { DEFAULT_PICKUP_HOURS } from "@/lib/pickup";
import { DEFAULT_INSTALLMENTS_CONFIG } from "@/lib/installments";
import { sanitizePhoneBR, sanitizeCEP, sanitizeInstagram } from "@/lib/masks";
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