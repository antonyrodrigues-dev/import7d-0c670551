/** Rótulos da classificação canônica de catálogo (fonte: diagnostico_catalogo). */
import type { CatalogSituation } from "../types";

export const SITUATION_LABEL: Record<CatalogSituation, string> = {
  ACTIVE_VALID: "Ativo e vendável",
  ACTIVE_INVALID: "Ativo inválido",
  PREVIEW_READY: "Em conferência",
  INACTIVE_READY: "Pronto para publicar",
  INACTIVE_PRICE_PENDING: "Preço pendente",
  INACTIVE_SIZE_PENDING: "Tamanho pendente",
  INACTIVE_PHOTO_PENDING: "Foto pendente",
  INACTIVE_PHYSICAL_CHECK: "Conferência física pendente",
  ARQUIVADO: "Arquivado",
};
