/**
 * Tipos de configuração operacional da loja. O painel edita APENAS conteúdo
 * operacional — identidade visual (Hero, Manifesto, tipografia, cores)
 * permanece imutável e nunca é exposta neste domínio.
 */

/** 0=Domingo … 6=Sábado. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Horário de funcionamento de UM dia da semana. */
export interface BusinessDayHours {
  weekday: Weekday;
  /** `false` = loja fechada nesse dia (from/to ignorados). */
  open: boolean;
  /** `HH:mm` (24h) */
  from: string;
  /** `HH:mm` (24h) */
  to: string;
}

/** Janelas de retirada de UM dia da semana. */
export interface PickupDaySlots {
  weekday: Weekday;
  /** `HH:mm` ordenados. Vazio = sem retirada nesse dia. */
  slots: string[];
}

/**
 * Visão flat consumida pela UI de Configurações e pelo Checkout. Conteúdo
 * institucional (Hero, Manifesto, Logo, Vídeo, Banner) NÃO pertence aqui —
 * é frontend imutável.
 */
export interface AdminSettings {
  /** Somente dígitos, com DDI 55 garantido. */
  whatsapp: string;
  telefone: string;
  email: string;
  /** `@handle` normalizado. */
  instagram: string;
  facebook: string;
  endereco: string;
  /** Somente dígitos. */
  cep: string;
  cidade: string;
  /** Sempre com 7 posições (Dom→Sáb). */
  businessHours: BusinessDayHours[];
  /** Sempre com 7 posições (Dom→Sáb). */
  pickupSlots: PickupDaySlots[];
  /** 1..12 */
  parcelamentoMax: number;
  /** Valor mínimo por parcela em BRL. */
  parcelaMinima: number;
}