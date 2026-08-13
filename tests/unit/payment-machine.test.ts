import { describe, expect, it } from "vitest";
import {
  PAYMENT_TRANSITIONS,
  canTransitionPayment,
  nextPaymentStates,
} from "@/features/admin/lib/paymentMachine";
import { PAYMENT_STATES } from "@/features/admin/types";

describe("máquina canônica de pagamento", () => {
  it("cobre todos os estados oficiais", () => {
    PAYMENT_STATES.forEach((s) => {
      expect(PAYMENT_TRANSITIONS[s.key]).toBeDefined();
    });
    expect(Object.keys(PAYMENT_TRANSITIONS)).toHaveLength(PAYMENT_STATES.length);
  });

  it("estorno só após confirmação", () => {
    expect(canTransitionPayment("confirmado", "estornado")).toBe(true);
    expect(canTransitionPayment("pendente", "estornado")).toBe(false);
    expect(canTransitionPayment("em_analise", "estornado")).toBe(false);
    expect(canTransitionPayment("recusado", "estornado")).toBe(false);
  });

  it("estornado é terminal", () => {
    expect(nextPaymentStates("estornado")).toEqual([]);
  });

  it("confirmado não volta para estados operacionais", () => {
    expect(canTransitionPayment("confirmado", "pendente")).toBe(false);
    expect(canTransitionPayment("confirmado", "recusado")).toBe(false);
  });
});
