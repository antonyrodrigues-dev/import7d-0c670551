/**
 * Serviço de estoque. Fonte atual: catálogo estático em `src/data/products`.
 * Preparado para migrar para persistência real sem alterar a UI.
 * Separa conceitualmente Produto × Variação × Estoque via `stockBySize`.
 */

import { PRODUCTS } from "@/data/products";
import type { InventoryItem, StockEntry } from "../types";

function inferBrand(name: string): string {
  const parts = name.split(" ");
  return parts[0] ?? "—";
}

function inferColor(name: string): string {
  const palette = ["Marfim", "Azul", "Conhaque", "Preto", "Oliva", "Cinza"];
  return palette.find((c) => name.toLowerCase().includes(c.toLowerCase())) ?? "—";
}

const DEFAULT_QTY = 5;
const NOW = new Date().toISOString();

export async function listInventory(): Promise<InventoryItem[]> {
  return PRODUCTS.map((p, i) => {
    const stockBySize: StockEntry[] = p.sizes.map((size) => ({ size, quantity: DEFAULT_QTY }));
    const quantity = stockBySize.reduce((a, s) => a + s.quantity, 0);
    return {
      id: p.slug,
      sku: `7D-${String(i + 1).padStart(3, "0")}`,
      slug: p.slug,
      name: p.name,
      brand: inferBrand(p.name),
      category: p.category,
      color: inferColor(p.name),
      images: [p.image],
      image: p.image,
      sizes: [...p.sizes],
      stockBySize,
      quantity,
      price: p.price,
      active: true,
      featured: Boolean(p.featured),
      criadoEm: NOW,
      atualizadoEm: NOW,
    };
  });
}
