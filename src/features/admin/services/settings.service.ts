import { BRAND, ATTENDANTS } from "@/config/attendants";
import { DEFAULT_PICKUP_HOURS } from "@/lib/pickup";
import { DEFAULT_INSTALLMENTS_CONFIG } from "@/lib/installments";
import type { AdminSettings } from "../types";

/** Retorna as configurações operacionais atuais da loja. */
export function loadDefaultSettings(): AdminSettings {
  const attendant = ATTENDANTS[0];
  return {
    whatsapp: attendant?.phone ?? "",
    instagram: BRAND.instagram.handle,
    facebook: "",
    endereco: BRAND.address.line,
    cep: "95012-500",
    cidade: BRAND.location,
    horarioFuncionamento: BRAND.hours,
    horarioRetirada: DEFAULT_PICKUP_HOURS.days
      .map((d) => `${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d.weekday]}: ${d.slots.join(", ")}`)
      .join(" · "),
    parcelamentoMax: DEFAULT_INSTALLMENTS_CONFIG.maxInstallments,
    textoHero: "Peças raras. Curadoria minuciosa. Atendimento privado.",
    textoManifesto: "Vestir bem é decisão silenciosa.",
    telefone: BRAND.whatsapp.label,
    email: "",
    logoUrl: "",
    videoHeroUrl: "",
    bannerHeroUrl: "",
    itensDestaque: [],
  };
}