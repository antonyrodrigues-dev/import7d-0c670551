/**
 * 7D IMPORTS — Objeto Pedido interno.
 *
 * Fonte única e canônica do pedido a partir da qual todas as saídas
 * (mensagem WhatsApp, futuro painel administrativo, futuro persistir em
 * banco) são derivadas. O checkout NUNCA deve montar essas saídas
 * diretamente a partir de campos de formulário: primeiro constrói um
 * `Order`, depois derivativas.
 *
 * Isso mantém o fluxo do checkout independente da camada de persistência:
 * quando o painel administrativo for implementado, basta trocar o destino
 * do objeto (in-memory → banco) sem tocar em UI.
 */

import type { ReservaItem } from "@/store/reserva";
import {
  generateOrderNumber,
  type Address,
  type Customer,
  type DeliveryMethod,
  type Freight,
  type PaymentMethod,
} from "@/lib/checkout";
import { getInstallmentOption, type InstallmentOption } from "@/lib/installments";

export interface OrderPickup {
  /** Data ISO local (YYYY-MM-DD). */
  date: string;
  /** Hora "HH:mm". */
  time: string;
}

export interface Order {
  numero: string;
  /** ISO com fuso — momento de criação do pedido. */
  criadoEm: string;
  cliente: Customer;
  itens: ReservaItem[];
  entrega: {
    metodo: DeliveryMethod;
    endereco?: Address;
    frete: Freight;
    /** Presente somente quando metodo === "retirada". */
    retirada?: OrderPickup;
  };
  pagamento: {
    metodo: PaymentMethod;
    parcelas: number;
    /** Detalhes de parcelamento quando cartão de crédito; null caso contrário. */
    parcelamento: InstallmentOption | null;
  };
  totais: {
    subtotal: number;
    frete: number;
    /** Total final já com eventual acréscimo de parcelamento. */
    total: number;
  };
}

export interface BuildOrderInput {
  items: ReservaItem[];
  customer: Customer;
  delivery: DeliveryMethod;
  address?: Address;
  freight: Freight;
  pickup?: OrderPickup;
  payment: PaymentMethod;
  installments: number;
  /** Opcional: injeta número/data para testes. */
  numero?: string;
  criadoEm?: string;
}

export function buildOrder(input: BuildOrderInput): Order {
  const subtotal = input.items.reduce((a, i) => a + i.price * i.quantity, 0);
  const freteValor = input.freight.cost ?? 0;
  const baseTotal = subtotal + freteValor;
  const parcelamento =
    input.payment === "credito" ? getInstallmentOption(baseTotal, input.installments) : null;
  const total = parcelamento ? parcelamento.total : baseTotal;

  return {
    numero: input.numero ?? generateOrderNumber(),
    criadoEm: input.criadoEm ?? new Date().toISOString(),
    cliente: input.customer,
    itens: input.items.map((i) => ({ ...i })),
    entrega: {
      metodo: input.delivery,
      endereco: input.delivery === "entrega" ? input.address : undefined,
      frete: input.freight,
      retirada: input.delivery === "retirada" ? input.pickup : undefined,
    },
    pagamento: {
      metodo: input.payment,
      parcelas: input.payment === "credito" ? input.installments : 1,
      parcelamento,
    },
    totais: {
      subtotal,
      frete: freteValor,
      total,
    },
  };
}