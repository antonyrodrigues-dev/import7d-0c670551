/**
 * Serviço do catálogo público — único ponto que traduz intenções de negócio
 * ("listar vitrine", "obter produto por slug") em chamadas de persistência.
 * A UI nunca chama o adapter direto.
 */
import { catalogDataSource } from "../adapters";
import type { PublicProduct } from "../types";

export function listActiveProducts(): Promise<PublicProduct[]> {
  return catalogDataSource.listActiveProducts();
}

export function findBySlug(list: PublicProduct[], slug: string): PublicProduct | undefined {
  return list.find((p) => p.slug === slug);
}

export function featuredOf(list: PublicProduct[]): PublicProduct[] {
  return list.filter((p) => p.featured);
}

export function categoriesOf(list: PublicProduct[]): string[] {
  return Array.from(new Set(list.map((p) => p.category)));
}