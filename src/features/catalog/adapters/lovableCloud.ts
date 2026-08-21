/**
 * Implementação `CatalogDataSource` que lê a VIEW `catalogo_publico`.
 *
 * A vitrine expõe apenas as colunas necessárias ao site. O papel `anon`
 * não tem mais acesso às tabelas `produtos`/`produto_variacoes`, portanto
 * observações internas, quantidade física, reservada, quarentena e a
 * origem do tamanho nunca trafegam para o navegador.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CatalogDataSource } from "./types";
import type { PublicProduct } from "../types";

interface Row {
  slug: string | null;
  nome: string | null;
  categoria: string | null;
  descricao: string | null;
  imagens: unknown;
  preco: number | string | null;
  preco_cartao: number | string | null;
  parcelamento: string | null;
  preco_confirmado: boolean | null;
  compravel: boolean | null;
  reservavel: boolean | null;
  tamanho_confirmado: boolean | null;
  marca: string | null;
  destaque: boolean | null;
  variacoes: unknown;
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

interface Variacao {
  tamanho: string;
  disponivel: number;
}

function parseVariacoes(raw: unknown): Variacao[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((v) => {
    if (typeof v !== "object" || v === null) return [];
    const o = v as Record<string, unknown>;
    if (typeof o["tamanho"] !== "string") return [];
    return [{ tamanho: o["tamanho"], disponivel: Number(o["disponivel"]) || 0 }];
  });
}

function mapRow(row: Row): PublicProduct {
  const images = parseImages(row.imagens);
  const variacoes = parseVariacoes(row.variacoes);
  const stockBySize: Record<string, number> = {};
  for (const v of variacoes) stockBySize[v.tamanho] = v.disponivel;
  const sizes = Object.keys(stockBySize).sort(sortSizes);
  const stock = variacoes.reduce((a, v) => a + v.disponivel, 0);
  return {
    slug: row.slug ?? "",
    name: row.nome ?? "",
    description: row.descricao ?? "",
    category: row.categoria ?? "",
    brand: row.marca ?? "",
    price: Number(row.preco) || 0,
    sizes,
    image: images[0] ?? "",
    imageHover: images[1] ?? images[0] ?? "",
    featured: Boolean(row.destaque),
    stock,
    stockBySize,
    compravel: Boolean(row.compravel),
    reservavel: Boolean(row.reservavel),
    tamanhoConfirmado: Boolean(row.tamanho_confirmado),
    precoConfirmado: Boolean(row.preco_confirmado),
    precoCartao: row.preco_cartao === null ? null : Number(row.preco_cartao) || null,
    parcelamento: row.parcelamento ?? null,
  };
}

export const lovableCloudCatalog: CatalogDataSource = {
  async listActiveProducts(): Promise<PublicProduct[]> {
    const { data, error } = await supabase
      .from("catalogo_publico")
      .select(
        "slug, nome, marca, categoria, descricao, imagens, preco, preco_cartao, parcelamento, preco_confirmado, compravel, reservavel, tamanho_confirmado, destaque, variacoes",
      )
      .order("criado_em", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => mapRow(r as Row));
  },
};
