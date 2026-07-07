/**
 * Serviço de estoque. Fonte atual: catálogo estático em `src/data/products`.
 * Preparado para migrar para tabela `produtos` no banco sem alterar UI.
 */

import { PRODUCTS } from "@/data/products";
import type { InventoryItem } from "../types";

function inferBrand(name: string): string {
  // Regra provisória — banco terá coluna dedicada.
  const parts = name.split(" ");
  return parts[0] ?? "—";
}

function inferColor(name: string): string {
  const palette = ["Marfim", "Azul", "Conhaque", "Preto", "Oliva", "Cinza"];
  return palette.find((c) => name.toLowerCase().includes(c.toLowerCase())) ?? "—";
}

export async function listInventory(): Promise<InventoryItem[]> {
  // Estoque provisório: 5 unidades por SKU até o painel gerenciar.
  return PRODUCTS.map((p, i) => ({
    id: p.slug,
    sku: `7D-${String(i + 1).padStart(3, "0")}`,
    slug: p.slug,
    name: p.name,
    brand: inferBrand(p.name),
    category: p.category,
    color: inferColor(p.name),
    sizes: [...p.sizes],
    quantity: 5,
    price: p.price,
    image: p.image,
    active: true,
    featured: Boolean(p.featured),
  }));
}