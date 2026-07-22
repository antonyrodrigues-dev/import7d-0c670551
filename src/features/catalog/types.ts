/**
 * Contrato canônico do catálogo público — consumido pelo site (Header,
 * FeaturedCarousel, ProductCard, ProductSheet, SearchDrawer, ReservaDrawer).
 *
 * Mantém a MESMA forma do antigo `src/data/products.ts` para que a migração
 * dos componentes seja um drop-in: bastará trocar `import { PRODUCTS } from
 * "@/data/products"` por `useCatalog()` sem alterar JSX.
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