/** Contratos do motor de regras de preço por categoria (fonte: banco). */

export interface PriceRule {
  category: string;
  price: number;
  cardPrice: number | null;
  installments: string | null;
  atualizadoEm: string;
}

/** Prévia obrigatória antes de qualquer aplicação em massa. */
export interface PriceRulePreview {
  category: string;
  /** Quantos produtos serão realmente alterados com os parâmetros atuais. */
  affected: number;
  /** Quantos já têm preço confirmado manualmente (preservados por padrão). */
  confirmed: number;
  /** Total de produtos não arquivados na categoria. */
  total: number;
}

export interface PriceRuleInput {
  category: string;
  price: number;
  cardPrice: number | null;
  installments: string | null;
  /** Sobrescrever também os preços já confirmados manualmente. */
  includeConfirmed: boolean;
}

export interface PriceRuleResult {
  category: string;
  affected: number;
  skus: string[];
}
