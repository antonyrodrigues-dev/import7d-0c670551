import { describe, expect, it } from "vitest";
import { applyOfficialSnapshot } from "@/lib/official-order";
import type { Order } from "@/lib/order";

const localOrder: Order = {
  numero: "LOCAL-999",
  criadoEm: "2026-07-28T12:00:00.000Z",
  atualizadoEm: "2026-07-28T12:00:00.000Z",
  status: "pending",
  metadata: { canal: "whatsapp" },
  cliente: { nome: "Ana", telefone: "11999999999", cpf: "", observacoes: "" },
  itens: [
    { slug: "polo-x", name: "FAKE BARATO", price: 1, image: "", size: "M", quantity: 99 },
  ],
  entrega: { metodo: "entrega", frete: { cost: 50, label: "R$ 50" } },
  pagamento: { metodo: "pix", parcelas: 1, parcelamento: null },
  totais: { subtotal: 99, frete: 50, total: 149 },
};

const row = {
  id: "11111111-1111-1111-1111-111111111111",
  numero_pedido: "7D-0007",
  valor_total: "598.00",
  snapshot: {
    produtos: [
      { slug: "polo-x", name: "Polo Oficial", size: "M", quantity: 2, price: "299.00", image: "a.jpg" },
    ],
    subtotal: "598.00",
    entrega: { metodo: "retirada", endereco: null, retirada: { date: "2026-08-01", time: "10:00" } },
    pagamento: { metodo: "credito", parcelas: 3 },
  },
};

describe("applyOfficialSnapshot", () => {
  it("substitui itens e valores manipulados pelo snapshot do servidor", () => {
    const { order } = applyOfficialSnapshot(localOrder, row);
    expect(order.numero).toBe("7D-0007");
    expect(order.itens).toHaveLength(1);
    expect(order.itens[0]).toMatchObject({ name: "Polo Oficial", price: 299, quantity: 2 });
    expect(order.totais).toEqual({ subtotal: 598, frete: 0, total: 598 });
  });

  it("usa entrega e pagamento oficiais, zerando dados locais divergentes", () => {
    const { order, pending } = applyOfficialSnapshot(localOrder, row);
    expect(order.entrega.metodo).toBe("retirada");
    expect(order.entrega.endereco).toBeUndefined();
    expect(order.entrega.retirada).toEqual({ date: "2026-08-01", time: "10:00" });
    expect(order.entrega.frete).toEqual({ cost: null, label: "A combinar" });
    expect(order.pagamento).toMatchObject({ metodo: "credito", parcelas: 3 });
    expect(pending.summary?.freteLabel).toBe("Retirada na loja");
    expect(pending.summary?.subtotalOficial).toBe(598);
    expect(pending.id).toBe(row.id);
  });

  it("rejeita resposta sem id ou número", () => {
    expect(() => applyOfficialSnapshot(localOrder, { ...row, id: null })).toThrow(
      /Resposta inválida/,
    );
    expect(() => applyOfficialSnapshot(localOrder, { ...row, numero_pedido: "" })).toThrow(
      /Resposta inválida/,
    );
  });

  it("rejeita snapshot sem itens válidos", () => {
    expect(() =>
      applyOfficialSnapshot(localOrder, { ...row, snapshot: { produtos: [] } }),
    ).toThrow(/Snapshot oficial vazio/);
    expect(() =>
      applyOfficialSnapshot(localOrder, {
        ...row,
        snapshot: { produtos: [{ slug: "x", size: "M", quantity: 0, price: 10 }] },
      }),
    ).toThrow(/Snapshot oficial vazio/);
  });

  it("mantém pedido íntegro quando o snapshot omite subtotal", () => {
    const { order } = applyOfficialSnapshot(localOrder, {
      ...row,
      snapshot: { ...row.snapshot, subtotal: undefined },
    });
    expect(order.totais.subtotal).toBe(598);
    expect(order.totais.total).toBe(598);
  });
});
