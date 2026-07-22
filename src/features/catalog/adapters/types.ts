import type { PublicProduct } from "../types";

/**
 * Contrato do "backend" do catálogo público.
 *
 * A UI do site nunca conversa direto com Supabase — vai por Service → Store →
 * Adapter, exatamente como o painel admin. Trocar a origem (Lovable Cloud
 * hoje, REST próprio no futuro, mock em testes) só edita este diretório.
 */
export interface CatalogDataSource {
  /** Lista todos os produtos ativos, com estoque agregado por variação. */
  listActiveProducts(): Promise<PublicProduct[]>;
}