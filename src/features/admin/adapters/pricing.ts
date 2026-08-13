/**
 * Adapter — Regras de preço por categoria.
 *
 * Toda a regra vive no banco (`previsualizar_regra_preco` / `aplicar_regra_preco`,
 * ambas restritas ao Admin Master). Aqui só traduzimos linhas para o domínio;
 * nenhum preço é calculado no cliente.
 */
import { supabase } from "@/integrations/supabase/client";
import type { PriceRule, PriceRuleInput, PriceRulePreview, PriceRuleResult } from "../types";

export const pricingAdapter = {
  async listRules(): Promise<PriceRule[]> {
    const { data, error } = await supabase
      .from("regras_preco_categoria")
      .select("categoria, preco, preco_cartao, parcelamento, atualizado_em")
      .order("categoria");
    if (error) throw error;
    return (data ?? []).map((r) => ({
      category: r.categoria,
      price: Number(r.preco ?? 0),
      cardPrice: r.preco_cartao == null ? null : Number(r.preco_cartao),
      installments: r.parcelamento,
      atualizadoEm: r.atualizado_em,
    }));
  },

  async preview(category: string, includeConfirmed: boolean): Promise<PriceRulePreview> {
    const { data, error } = await supabase.rpc("previsualizar_regra_preco", {
      p_categoria: category,
      p_incluir_confirmados: includeConfirmed,
    });
    if (error) throw error;
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      category,
      affected: Number(r["afetados"] ?? 0),
      confirmed: Number(r["confirmados"] ?? 0),
      total: Number(r["total"] ?? 0),
    };
  },

  async apply(input: PriceRuleInput): Promise<PriceRuleResult> {
    const { data, error } = await supabase.rpc("aplicar_regra_preco", {
      p_categoria: input.category,
      p_preco: input.price,
      p_preco_cartao: input.cardPrice,
      p_parcelamento: input.installments,
      p_incluir_confirmados: input.includeConfirmed,
    });
    if (error) throw error;
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      category: input.category,
      affected: Number(r["afetados"] ?? 0),
      skus: Array.isArray(r["skus"]) ? (r["skus"] as string[]) : [],
    };
  },
};
