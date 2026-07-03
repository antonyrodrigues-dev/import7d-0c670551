/**
 * 7D IMPORTS — Atendentes WhatsApp
 * Centraliza números/atendentes para gerar links de reserva.
 * Não usar hardcode fora deste arquivo.
 */
export interface Attendant {
  id: string;
  name: string;
  phone: string; // E.164 sem '+'
}

export const ATTENDANTS: Attendant[] = [
  { id: "ana", name: "Ana — Curadoria", phone: "5554981310049" },
];

export const DEFAULT_ATTENDANT = ATTENDANTS[0];

export const BRAND = {
  name: "7D IMPORTS",
  tagline: "Acesso a peças selecionadas",
  url: "",
  instagram: { handle: "@7dimports_", url: "https://instagram.com/7dimports_" },
  whatsapp: { label: "+55 54 98131-0049", url: "https://wa.me/5554981310049" },
  address: {
    line: "Rua Luiz Veronesi, 464 — Cinquentenário, Caxias do Sul · RS",
    mapsUrl: "https://maps.google.com/?q=Rua+Luiz+Veronesi+464+Cinquentenário+Caxias+do+Sul+RS",
  },
  hours: "Seg a Sex · 09h–18h · Sáb 10h–16h",
  location: "Caxias do Sul · Brasil",
} as const;
