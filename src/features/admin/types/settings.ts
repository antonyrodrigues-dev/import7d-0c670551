/**
 * Configurações agrupadas por domínio operacional. O painel edita apenas
 * conteúdo — identidade visual permanece imutável.
 */

export interface CompanySettings {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  email: string;
  telefone: string;
}

export interface StoreSettings {
  endereco: string;
  cep: string;
  cidade: string;
  estado: string;
  businessHours: BusinessDayHours[];
}

export interface ContactSettings {
  whatsapp: string;
  telefone: string;
  email: string;
}

export interface SocialSettings {
  instagram: string;
  facebook: string;
  tiktok?: string;
}

export interface DeliverySettings {
  ativa: boolean;
  raio: string;
  observacoes: string;
}

export interface PickupSettings {
  slots: PickupDaySlots[];
  antecedenciaMinimaHoras: number;
  horizonteDias: number;
}

export interface InstallmentsSettings {
  parcelamentoMax: number;
  parcelaMinima: number;
  chavePix: string;
}

export interface NotificationsSettings {
  emailAlertas: boolean;
  telegramChatId: string;
}

export interface SystemSettings {
  versao: string;
  ambiente: "producao" | "homologacao";
}

export interface AdminSettingsGrouped {
  empresa: CompanySettings;
  loja: StoreSettings;
  contato: ContactSettings;
  redes: SocialSettings;
  entrega: DeliverySettings;
  retirada: PickupSettings;
  parcelamento: InstallmentsSettings;
  notificacoes: NotificationsSettings;
  sistema: SystemSettings;
}

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