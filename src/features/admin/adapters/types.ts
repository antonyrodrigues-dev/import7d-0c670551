/**
 * Contrato do "backend" do painel administrativo.
 *
 * Serviços do admin dependem apenas desta interface — não conhecem qual
 * origem de dados atende (Lovable Cloud hoje, REST próprio no futuro,
 * fila em memória para testes). Trocar a origem só edita este diretório.
 */

import type {
  AdminCustomer,
  AdminOrder,
  Employee,
  EmployeeRole,
  InventoryItem,
  KitAvailability,
  OrderStatus,
} from "../types";

/** Consulta paginada de pedidos resolvida no servidor. */
export interface OrdersPageQuery {
  statuses?: OrderStatus[];
  busca?: string;
  offset: number;
  limit: number;
}

export interface OrdersPage {
  orders: AdminOrder[];
  total: number;
}

/** Consulta paginada de clientes resolvida no servidor. */
export interface CustomersPageQuery {
  busca?: string;
  offset: number;
  limit: number;
}

export interface CustomersPage {
  customers: AdminCustomer[];
  total: number;
}

/** Um evento da trilha imutável do pedido (`pedido_eventos`). */
export interface OrderAuditEntry {
  id: string;
  tipo: string;
  origem: string;
  criadoEm: string;
  porUsuario?: string;
  detalhe: Record<string, unknown>;
}

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

/** Origem física do tamanho conferido — só valores confirmados são aceitos. */
export type ConfirmedSizeOrigin = "confirmado_etiqueta" | "confirmado_medicao";

/** Dados coletados no Modo Conferência Rápida do Estoque. */
export interface ConferenceInput {
  productId: string;
  price: number;
  cardPrice?: number | null;
  installments?: string | null;
  size: string;
  origin: ConfirmedSizeOrigin;
  evidence: string;
  quantity: number;
}

export interface ConferenceResult {
  productId: string;
  publishStatus: string;
  canPublish: boolean;
  blockingReasons: string[];
}

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
  /** Página de pedidos filtrada e contada no servidor (`listar_pedidos`). */
  listOrdersPage(query: OrdersPageQuery): Promise<OrdersPage>;
  /** Base de clientes agregada no servidor a partir do ledger (`listar_clientes`). */
  listCustomers(query: CustomersPageQuery): Promise<CustomersPage>;
  /** Snapshot do dashboard calculado no servidor (`metricas_dashboard`). */
  dashboardMetrics(): Promise<Record<string, unknown>>;

  /**
   * Transiciona o pedido de forma atômica: valida a máquina de estados,
   * aplica consumo/estorno de estoque na MESMA transação do banco e grava
   * histórico. Ver RPC `transicionar_pedido` em migrations/2026-07-23.
   */
  transitionOrder(id: string, status: OrderStatus): Promise<void>;
  /** Cancela pedido pago estornando o ledger na mesma transação (Admin Master). */
  cancelOrderWithRefund(id: string, motivo?: string): Promise<void>;
  /** Trilha imutável de eventos do pedido (somente leitura, gravada pelo banco). */
  listOrderEvents(orderId: string): Promise<OrderAuditEntry[]>;

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
  /**
   * Conferência física da peça em UMA operação atômica no banco
   * (`conferir_produto`): preço oficial, tamanho com origem + evidência,
   * quantidade contada e marcação de conferência. O banco reavalia a
   * publicação — nada é decidido no cliente.
   */
  confirmConference(input: ConferenceInput): Promise<ConferenceResult>;
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
