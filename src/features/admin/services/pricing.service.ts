/**
 * Serviço — Regras de preço por categoria.
 *
 * Regra de negócio: preço é fonte única do banco. O painel só pode aplicar
 * uma regra depois de ver a PRÉVIA de impacto, e preços confirmados
 * manualmente nunca são sobrescritos sem escolha explícita do Admin Master.
 */
import { pricingAdapter } from "../adapters/pricing";
import { handleAdminError } from "../lib/errors";
import type { PriceRule, PriceRuleInput, PriceRulePreview, PriceRuleResult } from "../types";

export function listPriceRules(): Promise<PriceRule[]> {
  return pricingAdapter.listRules().catch((e) => {
    throw handleAdminError(e, "pricing.service.list");
  });
}

export function previewPriceRule(
  category: string,
  includeConfirmed: boolean,
): Promise<PriceRulePreview> {
  return pricingAdapter.preview(category, includeConfirmed).catch((e) => {
    throw handleAdminError(e, "pricing.service.preview");
  });
}

export function applyPriceRule(input: PriceRuleInput): Promise<PriceRuleResult> {
  if (!input.category.trim()) throw new Error("Selecione uma categoria.");
  if (!(input.price > 0)) throw new Error("Informe um preço maior que zero.");
  if (input.cardPrice !== null && !(input.cardPrice > 0)) {
    throw new Error("Preço no cartão deve ser maior que zero.");
  }
  return pricingAdapter.apply(input).catch((e) => {
    throw handleAdminError(e, "pricing.service.apply");
  });
}
