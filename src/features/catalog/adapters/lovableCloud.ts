/**
 * Implementação `CatalogDataSource` que lê a tabela `produtos` via chave
 * publicável (anon). Depende das policies:
 *   - "Public can view active products"
 *   - "Public can view variations of active products"
 * já existentes no schema — nenhum dado sensível é exposto.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CatalogDataSource } from "./types";
import type { PublicProduct } from "../types";

interface Row {
  slug: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  imagens: unknown;
  preco: number | string;
  destaque: boolean;
  produto_variacoes: { tamanho: string; disponivel: number }[] | null;
}

const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "XGG"];
function sortSizes(a: string, b: string): number {
  const ai = SIZE_ORDER.indexOf(a);
  const bi = SIZE_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

function parseImages(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string") : [];
}

function mapRow(row: Row): PublicProduct {
  const images = parseImages(row.imagens);
  const variacoes = row.produto_variacoes ?? [];
  const stockBySize: Record<string, number> = {};
  for (const v of variacoes) stockBySize[v.tamanho] = v.disponivel ?? 0;
  const sizes = Object.keys(stockBySize).sort(sortSizes);
  const stock = variacoes.reduce((a, v) => a + (v.disponivel ?? 0), 0);
  return {
    slug: row.slug,
    name: row.nome,
    description: row.descricao ?? "",
    category: row.categoria,
    price: Number(row.preco) || 0,
    sizes,
    image: images[0] ?? "",
    imageHover: images[1] ?? images[0] ?? "",
    featured: Boolean(row.destaque),
    stock,
    stockBySize,
  };
}

export const lovableCloudCatalog: CatalogDataSource = {
  async listActiveProducts(): Promise<PublicProduct[]> {
    const { data, error } = await supabase
      .from("produtos")
      .select(
        "slug, nome, categoria, descricao, imagens, preco, destaque, produto_variacoes ( tamanho, disponivel )",
      )
      .eq("ativo", true)
      .is("arquivado_em", null)
      .order("criado_em", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => mapRow(r as Row));
  },
};
