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

/** Modelo de estoque do produto (fonte: `produtos.modelo_estoque`). */
export type StockModel = "peca_unica" | "multi_variante" | "kit";

/**
 * Uma peça que compõe um kit, num tamanho específico do kit.
 * Kit não possui saldo próprio: a disponibilidade nasce daqui.
 */
export interface KitComponent {
  id: string;
  kitId: string;
  kitSize: string;
  componentId: string;
  componentSku: string;
  componentName: string;
  componentSize: string;
  /** Quantidade da peça consumida por 1 unidade do kit. */
  quantity: number;
  /** Saldo disponível da peça (físico − reservado − quarentena). */
  componentAvailable: number;
}

/** Disponibilidade derivada de um tamanho do kit. */
export interface KitAvailability {
  kitSize: string;
  available: number;
  components: KitComponent[];
}

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
  /** Como o saldo desse produto é controlado. Kits derivam das peças. */
  stockModel: StockModel;
  criadoEm: IsoDateTime;
  atualizadoEm: IsoDateTime;
}
