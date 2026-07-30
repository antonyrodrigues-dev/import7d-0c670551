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
  price: number;
  sizes: string[];
  image: string;
  imageHover: string;
  featured: boolean;
  /** Estoque total (soma das variações). Zero significa esgotado. */
  stock: number;
  /** Estoque por tamanho (para o ProductSheet desabilitar opções sem saldo). */
  stockBySize: Record<string, number>;
}

export const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });
