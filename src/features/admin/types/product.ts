import type { IsoDateTime } from "./common";

/** Produto (identidade e apresentação). */
export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  collection?: string;
  description?: string;
  images: string[];
  price: number;
  active: boolean;
  featured: boolean;
  criadoEm: IsoDateTime;
  atualizadoEm: IsoDateTime;
}

/** Variação (tamanho / cor / SKU secundário). */
export interface ProductVariation {
  size: string;
  color?: string;
}

/** Entrada de estoque de uma variação. */
export interface StockEntry {
  size: string;
  quantity: number;
}

/** Tipos canônicos de movimentação de estoque. */
export type MovementKind = "entrada" | "saida" | "ajuste" | "reposicao";

/** Visão consolidada Produto × Variação × Estoque para a tabela de estoque. */
export interface InventoryItem {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  collection?: string;
  color: string;
  description?: string;
  images: string[];
  image: string;
  sizes: string[];
  stockBySize: StockEntry[];
  quantity: number;
  price: number;
  active: boolean;
  featured: boolean;
  criadoEm: IsoDateTime;
  atualizadoEm: IsoDateTime;
}