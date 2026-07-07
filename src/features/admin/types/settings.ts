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
  horarioFuncionamento: string;
}

export interface HeroSettings {
  textoHero: string;
  textoManifesto: string;
  videoHeroUrl: string;
  bannerHeroUrl: string;
  logoUrl: string;
  itensDestaque: string[];
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
  horarioRetirada: string;
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
  hero: HeroSettings;
  contato: ContactSettings;
  redes: SocialSettings;
  entrega: DeliverySettings;
  retirada: PickupSettings;
  parcelamento: InstallmentsSettings;
  notificacoes: NotificationsSettings;
  sistema: SystemSettings;
}

/**
 * Visão flat consumida pela UI atual de Configurações. Um selector converte
 * a estrutura agrupada nessa forma achatada — a UI evolui em ritmo próprio
 * sem quebrar a nova tipagem por domínio.
 */
export interface AdminSettings {
  whatsapp: string;
  instagram: string;
  facebook: string;
  endereco: string;
  cep: string;
  cidade: string;
  horarioFuncionamento: string;
  horarioRetirada: string;
  parcelamentoMax: number;
  textoHero: string;
  textoManifesto: string;
  telefone: string;
  email: string;
  logoUrl: string;
  videoHeroUrl: string;
  bannerHeroUrl: string;
  itensDestaque: string[];
}