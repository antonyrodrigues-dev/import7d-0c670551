/**
 * Adapter — Qualidade do catálogo.
 *
 * Única porta de persistência do diagnóstico de publicação. O gate canônico
 * vive no banco (`diagnostico_catalogo` / `avaliar_publicacao`); aqui apenas
 * traduzimos linhas para o contrato de domínio.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CatalogDiagnostic, CatalogQualitySummary, CatalogSituation } from "../types";

const SITUATIONS: readonly CatalogSituation[] = [
  "ACTIVE_VALID",
  "ACTIVE_INVALID",
  "PREVIEW_READY",
  "INACTIVE_READY",
  "INACTIVE_PRICE_PENDING",
  "INACTIVE_SIZE_PENDING",
  "INACTIVE_PHOTO_PENDING",
  "INACTIVE_PHYSICAL_CHECK",
  "ARQUIVADO",
];

function toSituation(v: string | null): CatalogSituation {
  return (SITUATIONS as string[]).includes(v ?? "")
    ? (v as CatalogSituation)
    : "INACTIVE_PHYSICAL_CHECK";
}

export const catalogQualityAdapter = {
  async listDiagnostics(): Promise<CatalogDiagnostic[]> {
    const { data, error } = await supabase.rpc("diagnostico_catalogo");
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.nome,
      category: r.categoria,
      brand: r.marca,
      active: r.ativo,
      archived: r.arquivado,
      publishStatus: r.status_publicacao,
      price: Number(r.preco ?? 0),
      cardPrice: r.preco_cartao == null ? null : Number(r.preco_cartao),
      priceStatus: r.preco_status,
      stockModel: r.modelo_estoque,
      quantityChecked: r.quantidade_conferida,
      cover: r.foto_principal,
      photos: r.fotos ?? 0,
      sizes: Array.isArray(r.tamanhos)
        ? (r.tamanhos as unknown as CatalogDiagnostic["sizes"])
        : [],
      quantity: r.quantidade ?? 0,
      reserved: r.reservada ?? 0,
      quarantine: r.quarentena ?? 0,
      available: r.disponivel ?? 0,
      canPublish: r.can_publish ?? false,
      missingFields: r.missing_fields ?? [],
      blockingReasons: r.blocking_reasons ?? [],
      situation: toSituation(r.situacao),
    }));
  },

  async summary(): Promise<CatalogQualitySummary> {
    const { data, error } = await supabase.rpc("qualidade_catalogo");
    if (error) throw error;
    return (data ?? {}) as unknown as CatalogQualitySummary;
  },
};
