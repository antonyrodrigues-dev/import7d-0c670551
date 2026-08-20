import { describe, expect, it } from "vitest";
import { ORDER_STATUSES } from "@/features/admin/constants";
import {
  ATTENTION_MINUTES,
  ORDERS_TABS,
  countByTab,
  itemsSummary,
  matchesTab,
  needsAttention,
  netValue,
  paymentLabel,
  statusLabel,
  statusTone,
} from "@/features/admin/lib/orderView";
import type { AdminOrder, OrderStatus } from "@/features/admin/types";

function order(patch: Partial<AdminOrder> = {}): AdminOrder {
  const now = new Date().toISOString();
  return {
    id: "id-1",
    numero: "#P0001",
    cliente: { nome: "Cliente", telefone: "31999990000" },
    itens: [{ slug: "polo", name: "Polo Piquet", price: 200, size: "P", quantity: 2 }],
    quantidadeTotal: 2,
    valorTotal: 400,
    entrega: "retirada",
    pagamento: { metodo: "pix" },
    status: "novo",
    pagamentoEstado: "aguardando_comprovante",
    valorDevolvido: 0,
    criadoEm: now,
    atualizadoEm: now,
    historico: [],
    ...patch,
  };
}

describe("orderView — apresentação única dos pedidos", () => {
  it("as abas cobrem todos os 13 status oficiais, sem duplicar", () => {
    const cobertos = ORDERS_TABS.flatMap((t) => t.statuses);
    const oficiais = ORDER_STATUSES.map((s) => s.key);
    expect(new Set(cobertos).size).toBe(cobertos.length);
    expect([...cobertos].sort()).toEqual([...oficiais].sort());
  });

  it("a aba Todos aceita qualquer pedido e conta o total", () => {
    const lista = [order(), order({ status: "cancelado" }), order({ status: "finalizado" })];
    expect(lista.every((o) => matchesTab(o, "todos"))).toBe(true);
    const counts = countByTab(lista);
    expect(counts.todos).toBe(3);
    expect(counts.cancelado).toBe(1);
    expect(counts.finalizado).toBe(1);
  });

  it("todo status oficial tem rótulo próprio e tom definido", () => {
    for (const { key, label } of ORDER_STATUSES) {
      expect(statusLabel(key)).toBe(label);
      expect(statusTone(key)).not.toBe("neutral");
    }
    expect(statusLabel("status_inexistente")).toBe("status_inexistente");
    expect(statusTone("status_inexistente")).toBe("neutral");
  });

  it("pagamento confirmado e estornado têm leitura distinta", () => {
    expect(paymentLabel("confirmado")).not.toBe("confirmado");
    expect(paymentLabel("estado_fantasma")).toBe("estado_fantasma");
  });

  it("valor líquido nunca fica negativo e desconta devoluções", () => {
    expect(netValue(order({ valorTotal: 400, valorDevolvido: 150 }))).toBe(250);
    expect(netValue(order({ valorTotal: 400, valorDevolvido: 900 }))).toBe(0);
  });

  it("atenção: pagamento recusado sempre, pipeline parado após o limite", () => {
    const agora = Date.now();
    const antigo = new Date(agora - (ATTENTION_MINUTES + 5) * 60000).toISOString();

    expect(needsAttention(order({ pagamentoEstado: "recusado" }), agora)).toBe(true);
    expect(needsAttention(order({ criadoEm: antigo }), agora)).toBe(true);
    expect(needsAttention(order(), agora)).toBe(false);
    // Pedido encerrado nunca pede atenção por tempo.
    expect(
      needsAttention(order({ status: "finalizado" as OrderStatus, criadoEm: antigo }), agora),
    ).toBe(false);
  });

  it("resumo de itens é compacto e pluraliza corretamente", () => {
    expect(itemsSummary(order())).toBe("2× Polo Piquet (P)");
    const dois = order({
      itens: [
        { slug: "a", name: "Polo", price: 100, size: "P", quantity: 1 },
        { slug: "b", name: "Camisa", price: 100, size: "M", quantity: 1 },
      ],
    });
    expect(itemsSummary(dois)).toBe("1× Polo (P) +1 item");
    expect(itemsSummary(order({ itens: [] }))).toBe("Sem itens");
  });
});
