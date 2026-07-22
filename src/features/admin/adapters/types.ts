/**
 * Contrato do "backend" do painel administrativo.
 *
 * Serviços do admin dependem apenas desta interface — não conhecem qual
 * origem de dados atende (Lovable Cloud hoje, REST próprio no futuro,
 * fila em memória para testes). Trocar a origem só edita este diretório.
 */

import type {
  AdminOrder,
  Employee,
  EmployeeRole,
  InventoryItem,
  OrderStatus,
} from "../types";

export interface AdminIdentity {
  userId: string | null;
  roles: EmployeeRole[];
  /** Nome exibido (metadata `full_name`/`name`) — usado em auditoria/ranking. */
  displayName?: string;
  email?: string;
}

/** Payload aceito por `createProduct` / `updateProduct`. */
export interface ProductWritePayload {
  sku: string;
  slug: string;
  nome: string;
  marca: string;
  categoria: string;
  cor?: string | null;
  colecao?: string | null;
  descricao?: string | null;
  imagens: string[];
  preco: number;
  ativo: boolean;
  destaque: boolean;
  variacoes: { tamanho: string; quantidade: number }[];
}

export type MovementKindDB =
  | "entrada"
  | "saida"
  | "ajuste"
  | "reposicao"
  | "consumo_pedido";

export interface AdminDataSource {
  // Identidade / autorização
  currentIdentity(): Promise<AdminIdentity>;

  // Pedidos
  listOrders(): Promise<AdminOrder[]>;
  updateOrderStatus(id: string, status: OrderStatus): Promise<void>;

  // Funcionários
  listEmployees(): Promise<Employee[]>;

  // Produtos / Estoque
  listInventory(): Promise<InventoryItem[]>;
  createProduct(p: ProductWritePayload): Promise<string>;
  updateProduct(id: string, p: ProductWritePayload): Promise<void>;
  archiveProduct(id: string): Promise<void>;
  restoreProduct(id: string): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  setVariationStock(
    productId: string,
    tamanho: string,
    quantidade: number,
    kind: MovementKindDB,
    observacao?: string,
  ): Promise<void>;
}