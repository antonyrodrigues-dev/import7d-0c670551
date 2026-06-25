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
} as const;