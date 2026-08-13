/**
 * Serviço — Qualidade do catálogo.
 *
 * Regra de negócio: o gate de publicação é ÚNICO e vive no banco.
 * O frontend nunca recalcula "pode publicar"; apenas apresenta o veredito
 * e traduz filtros operacionais.
 */
import { catalogQualityAdapter } from "../adapters/catalogQuality";
import { handleAdminError } from "../lib/errors";
import type {
  CatalogDiagnostic,
  CatalogQualityFilter,
  CatalogQualitySummary,
} from "../types";

export function listCatalogDiagnostics(): Promise<CatalogDiagnostic[]> {
  return catalogQualityAdapter.listDiagnostics().catch((e) => {
    throw handleAdminError(e, "catalogQuality.service.list");
  });
}

export function getCatalogSummary(): Promise<CatalogQualitySummary> {
  return catalogQualityAdapter.summary().catch((e) => {
    throw handleAdminError(e, "catalogQuality.service.summary");
  });
}

export function matchesQualityFilter(d: CatalogDiagnostic, f: CatalogQualityFilter): boolean {
  switch (f) {
    case "todos":
      return true;
    case "ativosValidos":
      return d.situation === "ACTIVE_VALID";
    case "preview":
      return !d.archived && !d.canPublish && d.photos > 0;
    case "rascunhos":
      return !d.archived && d.publishStatus !== "publicado";
    case "semPreco":
      return !d.archived && d.missingFields.includes("preco");
    case "semTamanho":
      return !d.archived && d.missingFields.includes("tamanho");
    case "semFoto":
      return !d.archived && d.missingFields.includes("foto");
    case "semQuantidadeConferida":
      return !d.archived && d.missingFields.includes("quantidade");
    case "vendidos":
      return !d.archived && d.quantity > 0 && d.available === 0 && d.reserved === 0 && d.quarantine === 0;
    case "reservados":
      return d.reserved > 0;
    case "quarentena":
      return d.quarantine > 0;
    case "arquivados":
      return d.archived;
    default:
      return true;
  }
}
