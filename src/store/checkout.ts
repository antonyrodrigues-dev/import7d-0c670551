/**
 * 7D IMPORTS — Estado do checkout.
 *
 * Persistido em localStorage para que ao atualizar a página o cliente
 * mantenha: etapa atual, forma de entrega, endereço, dados pessoais,
 * forma de pagamento, parcelamento e horário de retirada.
 *
 * O carrinho (itens) vive em `useReserva` — este store cuida apenas do
 * checkout ao redor. Frete NÃO é persistido: é derivado do endereço.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Address, Customer, DeliveryMethod, PaymentMethod } from "@/lib/checkout";
import { isValidPickupSlot } from "@/lib/pickup";
import type { OrderPickup } from "@/lib/order";
import type { ReservaItem } from "@/store/reserva";

export type CheckoutStep = 0 | 1 | 2 | 3 | 4;

export const emptyAddress: Address = {
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
};

export const emptyCustomer: Customer = { nome: "", telefone: "", cpf: "", observacoes: "" };

/**
 * Pedido criado no banco aguardando envio via WhatsApp. Persistido para que
 * o retorno ao site (após abrir WA em outra aba) mostre o CTA correto.
 */
export interface PendingOrder {
  id: string;
  numero: string;
  url: string;
  criadoEm: string;
  /** Chave da tentativa que criou o pedido — necessária para cancelamento seguro/idempotente. */
  idempotencyKey?: string;
  /** Snapshot imutável exibido no pós-criação; não depende do carrinho vivo. */
  summary?: {
    itens: ReservaItem[];
    subtotalOficial: number;
    entrega: DeliveryMethod;
    endereco?: Address;
    retirada?: OrderPickup | null;
    freteLabel: string;
    pagamento: PaymentMethod;
    parcelas: number;
  };
}

interface CheckoutState {
  step: CheckoutStep;
  delivery: DeliveryMethod;
  address: Address;
  customer: Customer;
  payment: PaymentMethod;
  installments: number;
  pickup: OrderPickup | null;
  /** Chave gerada uma única vez por tentativa — impede pedido duplicado no clique duplo. */
  idempotencyKey: string | null;
  /** Pedido registrado no banco aguardando envio pelo WhatsApp. */
  pendingOrder: PendingOrder | null;

  setStep: (s: CheckoutStep) => void;
  setDelivery: (d: DeliveryMethod) => void;
  setAddress: (a: Address) => void;
  setCustomer: (c: Customer) => void;
  setPayment: (p: PaymentMethod) => void;
  setInstallments: (n: number) => void;
  setPickup: (p: OrderPickup | null) => void;
  ensureIdempotencyKey: () => string;
  clearIdempotencyKey: () => void;
  setPendingOrder: (p: PendingOrder | null) => void;
  reset: () => void;
}

const initial = {
  step: 0 as CheckoutStep,
  delivery: "retirada" as DeliveryMethod,
  address: emptyAddress,
  customer: emptyCustomer,
  payment: "pix" as PaymentMethod,
  installments: 1,
  pickup: null as OrderPickup | null,
  idempotencyKey: null as string | null,
  pendingOrder: null as PendingOrder | null,
};

function makeKey(): string {
  const g = globalThis.crypto as Crypto | undefined;
  if (g?.randomUUID) return g.randomUUID();
  return `key_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const useCheckout = create<CheckoutState>()(
  persist(
    (set, get) => ({
      ...initial,
      setStep: (step) => set({ step }),
      setDelivery: (delivery) => set({ delivery }),
      setAddress: (address) => set({ address }),
      setCustomer: (customer) => set({ customer }),
      setPayment: (payment) =>
        set((s) => ({ payment, installments: payment === "credito" ? s.installments : 1 })),
      setInstallments: (installments) => set({ installments }),
      setPickup: (pickup) => set({ pickup }),
      ensureIdempotencyKey: () => {
        const cur = get().idempotencyKey;
        if (cur) return cur;
        const key = makeKey();
        set({ idempotencyKey: key });
        return key;
      },
      clearIdempotencyKey: () => set({ idempotencyKey: null }),
      setPendingOrder: (pendingOrder) => set({ pendingOrder }),
      reset: () => set({ ...initial }),
    }),
    {
      name: "7d-checkout",
      partialize: (s) => ({
        step: s.step,
        delivery: s.delivery,
        address: s.address,
        customer: s.customer,
        payment: s.payment,
        installments: s.installments,
        pickup: s.pickup,
        idempotencyKey: s.idempotencyKey,
        pendingOrder: s.pendingOrder,
      }),
      // Sanitiza pickup expirado; nunca ressuscita um horário inválido.
      merge: (persisted, current) => {
        const p = (persisted as Partial<CheckoutState> | undefined) ?? {};
        const pickup =
          p.pickup && isValidPickupSlot(p.pickup.date, p.pickup.time) ? p.pickup : null;
        return { ...current, ...p, pickup };
      },
    },
  ),
);
