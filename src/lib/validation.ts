/**
 * 7D IMPORTS — Validação única do fluxo de reserva.
 *
 * Fonte única para regras de bloqueio de etapa e finalização do pedido.
 * Tanto o botão "Continuar" quanto o "Finalizar via WhatsApp" — e qualquer
 * futuro consumidor (painel admin, testes) — consultam APENAS estas funções.
 *
 * Retorno padrão:
 *   { ok: boolean; errors: Record<string,string>; missing: string[] }
 *
 *  - `errors`: map campo → mensagem (para inputs).
 *  - `missing`: chaves de blocos ausentes (para diagnóstico / testes).
 */

import {
  addressSchema,
  customerSchema,
  type Address,
  type Customer,
  type DeliveryMethod,
  type PaymentMethod,
} from "@/lib/checkout";
import { isValidPickupSlot } from "@/lib/pickup";
import type { OrderPickup } from "@/lib/order";
import type { ReservaItem } from "@/store/reserva";

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  missing: string[];
}

export interface CheckoutSnapshot {
  items: ReservaItem[];
  delivery: DeliveryMethod;
  address: Address;
  pickup: OrderPickup | null;
  customer: Customer;
  payment: PaymentMethod;
  installments: number;
}

function ok(): ValidationResult {
  return { ok: true, errors: {}, missing: [] };
}

function fromZodIssues(
  issues: readonly { path: (string | number)[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const k = issue.path[0]?.toString() ?? "form";
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}

/** Etapa 0 — reserva não pode estar vazia. */
export function validateItems(items: ReservaItem[]): ValidationResult {
  if (items.length === 0) {
    return { ok: false, errors: {}, missing: ["items"] };
  }
  for (const it of items) {
    if (!it.quantity || it.quantity < 1) {
      return { ok: false, errors: {}, missing: ["quantity"] };
    }
  }
  return ok();
}

/** Etapa 1 — entrega/retirada. */
export function validateDelivery(
  delivery: DeliveryMethod,
  address: Address,
  pickup: OrderPickup | null,
): ValidationResult {
  if (delivery === "entrega") {
    const r = addressSchema.safeParse(address);
    if (!r.success) {
      return { ok: false, errors: fromZodIssues(r.error.issues), missing: ["address"] };
    }
    return ok();
  }
  if (!pickup || !isValidPickupSlot(pickup.date, pickup.time)) {
    return {
      ok: false,
      errors: { pickup: "Selecione um horário disponível" },
      missing: ["pickup"],
    };
  }
  return ok();
}

/** Etapa 2 — dados do cliente. */
export function validateCustomer(customer: Customer): ValidationResult {
  const r = customerSchema.safeParse(customer);
  if (!r.success) {
    return { ok: false, errors: fromZodIssues(r.error.issues), missing: ["customer"] };
  }
  return ok();
}

/** Etapa 3 — pagamento. */
export function validatePayment(payment: PaymentMethod, installments: number): ValidationResult {
  if (!payment) return { ok: false, errors: {}, missing: ["payment"] };
  if (payment === "credito" && (installments < 1 || installments > 12)) {
    return {
      ok: false,
      errors: { installments: "Parcelamento inválido" },
      missing: ["installments"],
    };
  }
  return ok();
}

/** Validação por etapa do drawer. */
export function validateStep(step: 0 | 1 | 2 | 3 | 4, s: CheckoutSnapshot): ValidationResult {
  if (step === 0) return validateItems(s.items);
  if (step === 1) return validateDelivery(s.delivery, s.address, s.pickup);
  if (step === 2) return validateCustomer(s.customer);
  if (step === 3) return validatePayment(s.payment, s.installments);
  return validateOrder(s);
}

/** Validação completa antes de gerar o objeto Order. */
export function validateOrder(s: CheckoutSnapshot): ValidationResult {
  const merged: ValidationResult = { ok: true, errors: {}, missing: [] };
  for (const r of [
    validateItems(s.items),
    validateDelivery(s.delivery, s.address, s.pickup),
    validateCustomer(s.customer),
    validatePayment(s.payment, s.installments),
  ]) {
    if (!r.ok) merged.ok = false;
    Object.assign(merged.errors, r.errors);
    merged.missing.push(...r.missing);
  }
  return merged;
}
