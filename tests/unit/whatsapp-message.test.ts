import { describe, expect, it } from "vitest";
import { buildOrder } from "@/lib/order";
import { buildReservaMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import type { BuildOrderInput } from "@/lib/order";

const baseInput: BuildOrderInput = {
  items: [
    { slug: "polo-piquet", name: "Polo Piquet Marfim", price: 259.9, size: "P", quantity: 2 },
  ],
  customer: { nome: "Ana Souza", telefone: "(31) 99999-0000", cpf: "390.533.447-05" },
  delivery: "retirada",
  freight: { cost: null, label: "A combinar" },
  pickup: { date: "2026-09-01", time: "10:00" },
  payment: "pix",
  installments: 1,
  numero: "#P0042",
  criadoEm: "2026-08-20T13:00:00.000Z",
} as BuildOrderInput;

describe("mensagem e link de WhatsApp — fonte única do pedido", () => {
  it("a mensagem deriva do pedido e não contém campos vazios", () => {
    const msg = buildReservaMessage(buildOrder(baseInput));
    expect(msg).toContain("#P0042");
    expect(msg).toContain("Ana Souza");
    expect(msg).toContain("Polo Piquet Marfim");
    expect(msg).not.toMatch(/undefined|null|NaN/);
    expect(msg.split("\n\n\n")).toHaveLength(1);
  });

  it("frete a combinar aparece pelo rótulo, nunca como R$ 0,00", () => {
    const order = buildOrder({
      ...baseInput,
      delivery: "entrega",
      address: {
        rua: "Rua A",
        numero: "10",
        bairro: "Centro",
        cidade: "Caxias do Sul",
        cep: "95000-000",
      },
    } as BuildOrderInput);
    const msg = buildReservaMessage(order);
    expect(msg).toContain("Frete A combinar");
    expect(msg).not.toContain("Frete R$ 0,00");
  });

  it("o número oficial da loja substitui o atendente padrão", () => {
    const url = buildWhatsAppUrl(buildOrder(baseInput), "(54) 98888-7777");
    expect(url.startsWith("https://wa.me/54988887777?text=")).toBe(true);
  });

  it("sem número configurado não existe fallback hardcoded — falha explícita", () => {
    expect(() => buildWhatsAppUrl(buildOrder(baseInput), "123")).toThrow(/não configurado/i);
    expect(() => buildWhatsAppUrl(buildOrder(baseInput), "")).toThrow(/não configurado/i);
  });

  it("o texto do link é a própria mensagem codificada", () => {
    const order = buildOrder(baseInput);
    const url = buildWhatsAppUrl(order, "(54) 98888-7777");
    const texto = decodeURIComponent(url.split("?text=")[1]);
    expect(texto).toBe(buildReservaMessage(order));
  });
});
