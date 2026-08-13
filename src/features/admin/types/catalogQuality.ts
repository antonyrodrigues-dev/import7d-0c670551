/** Contratos do gate canônico de publicação (fonte: banco). */

export type CatalogSituation =
  | "ACTIVE_VALID"
  | "ACTIVE_INVALID"
  | "PREVIEW_READY"
  | "INACTIVE_READY"
  | "INACTIVE_PRICE_PENDING"
  | "INACTIVE_SIZE_PENDING"
  | "INACTIVE_PHOTO_PENDING"
  | "INACTIVE_PHYSICAL_CHECK"
  | "ARQUIVADO";

export type SizeOrigin =
  | "confirmado_etiqueta"
  | "confirmado_medicao"
  | "estimativa_interna"
  | "a_confirmar";

export interface CatalogSizeDiagnostic {
  tamanho: string;
  origem: SizeOrigin;
  evidencia: string | null;
  quantidade: number;
  reservada: number;
  quarentena: number;
  disponivel: number;
}

export interface CatalogDiagnostic {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  active: boolean;
  archived: boolean;
  publishStatus: string;
  price: number;
  cardPrice: number | null;
  priceStatus: string;
  stockModel: string;
  quantityChecked: boolean;
  cover: string | null;
  photos: number;
  sizes: CatalogSizeDiagnostic[];
  quantity: number;
  reserved: number;
  quarantine: number;
  available: number;
  canPublish: boolean;
  missingFields: string[];
  blockingReasons: string[];
  situation: CatalogSituation;
}

export interface CatalogQualitySummary {
  total: number;
  arquivados: number;
  ativosValidos: number;
  preview: number;
  rascunhos: number;
  semPreco: number;
  semTamanho: number;
  semFoto: number;
  semQuantidadeConferida: number;
  duplicidades: number;
  vendidos: number;
  reservados: number;
  quarentena: number;
}

/** Filtros de qualidade acionáveis a partir do Dashboard de Catálogo. */
export type CatalogQualityFilter =
  | "todos"
  | "ativosValidos"
  | "preview"
  | "rascunhos"
  | "semPreco"
  | "semTamanho"
  | "semFoto"
  | "semQuantidadeConferida"
  | "vendidos"
  | "reservados"
  | "quarentena"
  | "arquivados";
