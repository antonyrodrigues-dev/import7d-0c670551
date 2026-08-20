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
  KitAvailability,
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

export type MovementKindDB = "entrada" | "saida" | "ajuste" | "reposicao" | "consumo_pedido";

/** Uma linha de composição de kit gravada no banco. */
export interface KitComponentWritePayload {
  kitId: string;
  kitSize: string;
  componentId: string;
  componentSize: string;
  quantity: number;
}

export interface AdminDataSource {
  // Identidade / autorização
  currentIdentity(): Promise<AdminIdentity>;

  // Pedidos
  listOrders(): Promise<AdminOrder[]>;
  /**
   * Transiciona o pedido de forma atômica: valida a máquina de estados,
   * aplica consumo/estorno de estoque na MESMA transação do banco e grava
   * histórico. Ver RPC `transicionar_pedido` em migrations/2026-07-23.
   */
  transitionOrder(id: string, status: OrderStatus): Promise<void>;
  /** Cancela pedido pago estornando o ledger na mesma transação (Admin Master). */
  cancelOrderWithRefund(id: string, motivo?: string): Promise<void>;

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
  /** Envia a foto para o armazenamento privado e devolve a URL utilizável. */
  uploadProductImage(file: File, slug: string): Promise<string>;
  /** Assina mudanças de catálogo/estoque em tempo real. Devolve o cancelador. */
  subscribeInventory(onChange: () => void): () => void;

  // Kits — composição e disponibilidade derivada
  /** Composição do kit agrupada por tamanho, já com o saldo real das peças. */
  listKitComposition(kitId: string): Promise<KitAvailability[]>;
  addKitComponent(p: KitComponentWritePayload): Promise<void>;
  removeKitComponent(id: string): Promise<void>;
}
