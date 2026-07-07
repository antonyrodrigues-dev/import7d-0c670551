import type { IsoDateTime } from "./common";

export type OrderStatus =
  | "novo"
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
  endereco?: string;
  retirada?: OrderPickupSlot;
  pagamento: OrderPayment;
  status: OrderStatus;
  observacoes?: string;
  criadoEm: IsoDateTime;
  atualizadoEm: IsoDateTime;
}

// Alias mantido por compatibilidade com componentes existentes.
export type AdminOrderItem = OrderItem;