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

interface CheckoutState {
  step: CheckoutStep;
  delivery: DeliveryMethod;
  address: Address;
  customer: Customer;
  payment: PaymentMethod;
  installments: number;
  pickup: OrderPickup | null;

  setStep: (s: CheckoutStep) => void;
  setDelivery: (d: DeliveryMethod) => void;
  setAddress: (a: Address) => void;
  setCustomer: (c: Customer) => void;
  setPayment: (p: PaymentMethod) => void;
  setInstallments: (n: number) => void;
  setPickup: (p: OrderPickup | null) => void;
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
};

export const useCheckout = create<CheckoutState>()(
  persist(
    (set) => ({
      ...initial,
      setStep: (step) => set({ step }),
      setDelivery: (delivery) => set({ delivery }),
      setAddress: (address) => set({ address }),
      setCustomer: (customer) => set({ customer }),
      setPayment: (payment) =>
        set((s) => ({ payment, installments: payment === "credito" ? s.installments : 1 })),
      setInstallments: (installments) => set({ installments }),
      setPickup: (pickup) => set({ pickup }),
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