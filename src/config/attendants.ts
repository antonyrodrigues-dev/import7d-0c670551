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
  { id: "ana", name: "Ana — Curadoria", phone: "5511999999999" },
];

export const DEFAULT_ATTENDANT = ATTENDANTS[0];

export const BRAND = {
  name: "7D IMPORTS",
  tagline: "Acesso a peças selecionadas",
  url: "",
  instagram: { handle: "@7dimports", url: "https://instagram.com/7dimports" },
  whatsapp: { label: "+55 11 99999-9999", url: "https://wa.me/5511999999999" },
  address: {
    line: "Rua Oscar Freire, 725 — Jardins, São Paulo · SP",
    mapsUrl: "https://maps.google.com/?q=Rua+Oscar+Freire+725+São+Paulo",
  },
  hours: "Seg a Sex · 10h–19h · Sáb 11h–17h",
} as const;