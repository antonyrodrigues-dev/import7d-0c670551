import type { IsoDateTime } from "./common";
import type { PaymentState } from "./ops";

export type OrderStatus =
  | "novo"
  | "pagamento_confirmado"
  | "separado"
  | "reservado"
  | "aguardando_retirada"
  | "enviado"
  | "finalizado"
  | "cancelado";

export type DeliveryMethod = "entrega" | "retirada";

export interface OrderItem {
  slug: string;
  name: string;
  price: number;
  size: string;
  quantity: number;
  image?: string;
}

export interface OrderCustomerRef {
  nome: string;
  telefone: string;
  cidade?: string;
}

export interface OrderPickupSlot {
  data: IsoDateTime;
  janela: string;
}

export interface OrderPayment {
  metodo: string;
  parcelas?: number;
  valorParcela?: number;
}

/** Endereço estruturado do pedido (quando a modalidade é entrega). */
export interface OrderAddress {
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
  /** Linha única já formatada — fonte única para exibição. */
  linha: string;
}

/** Registro imutável do histórico de status de um pedido. */
export interface OrderHistoryEntry {
  status: OrderStatus;
  at: IsoDateTime;
  by?: string;
  note?: string;
}

/**
 * Contrato canônico de pedido — consumido por Dashboard, Pedidos, Clientes,
 * Notificações e Financeiro. Alterar aqui propaga por todo o painel.
 */
export interface AdminOrder {
  id: string;
  numero: string;
  cliente: OrderCustomerRef;
  itens: OrderItem[];
  quantidadeTotal: number;
  valorTotal: number;
  entrega: DeliveryMethod;
  /** Linha única formatada do endereço (compatibilidade). */
  endereco?: string;
  enderecoDetalhe?: OrderAddress;
  frete?: string;
  retirada?: OrderPickupSlot;
  pagamento: OrderPayment;
  status: OrderStatus;
  /** Estado financeiro oficial (coluna `pagamento_estado` do banco). */
  pagamentoEstado: PaymentState;
  /** Total já devolvido/estornado. */
  valorDevolvido: number;
  observacoes?: string;
  criadoEm: IsoDateTime;
  atualizadoEm: IsoDateTime;
  responsavel?: string;
  responsavelId?: string;
  atribuidoEm?: IsoDateTime;
  /** Canal de origem do pedido (site, whatsapp, balcão…). */
  canal?: string;
  historico: OrderHistoryEntry[];
}

// Alias mantido por compatibilidade com componentes existentes.
export type AdminOrderItem = OrderItem;
