/**
 * Contrato canônico do catálogo público — consumido pelo site (Header,
 * FeaturedCarousel, ProductCard, ProductSheet, SearchDrawer, ReservaDrawer).
 *
 * Única fonte de verdade do site: tudo é lido via `useCatalog()` a partir da
 * tabela `produtos` no backend.
 */
export interface PublicProduct {
  slug: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  price: number;
  sizes: string[];
  image: string;
  imageHover: string;
  featured: boolean;
  /** Estoque total (soma das variações). Zero significa esgotado. */
  stock: number;
  /** Estoque por tamanho (para o ProductSheet desabilitar opções sem saldo). */
  stockBySize: Record<string, number>;
  /**
   * Peça pode ser reservada agora (preço confirmado, tamanho confirmado,
   * quantidade conferida, foto e saldo disponível). Quando `false`, a peça
   * aparece na vitrine em MODO PRÉVIA: visível, porém não comprável.
   */
  compravel: boolean;
  /** Peça está ativa no acervo e pode entrar no funil de reserva. */
  reservavel: boolean;
  /** Existe ao menos um tamanho confirmado com saldo. */
  tamanhoConfirmado: boolean;
  /** O preço exibido é o preço oficial confirmado pela loja. */
  precoConfirmado: boolean;
  /** Preço no cartão (quando confirmado). */
  precoCartao: number | null;
  /** Texto de parcelamento oficial (quando confirmado). */
  parcelamento: string | null;
}

export const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });

/** Texto único usado sempre que o dado oficial ainda não existe. */
export const SOB_CONSULTA = "Sob consulta";

/**
 * Rótulo de preço da vitrine. Peça sem preço confirmado NUNCA exibe número —
 * o preço é definido no atendimento.
 */
export const priceLabel = (p: PublicProduct): string =>
  p.precoConfirmado ? formatBRL(p.price) : SOB_CONSULTA;
