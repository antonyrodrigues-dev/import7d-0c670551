import { describe, expect, it } from "vitest";
import {
  buildConsultaMessage,
  buildConsultaUrl,
  productPublicState,
} from "@/features/catalog/services/consulta.service";
import type { PublicProduct } from "@/features/catalog";

function produto(over: Partial<PublicProduct> = {}): PublicProduct {
  return {
    slug: "jaqueta-bmw",
    name: "Jaqueta BMW",
    description: "",
    category: "Jaquetas",
    price: 1200,
    sizes: ["M"],
    image: "",
    imageHover: "",
    featured: false,
    stock: 2,
    stockBySize: { M: 2 },
    compravel: true,
    precoConfirmado: true,
    precoCartao: null,
    parcelamento: null,
    ...over,
  };
}

describe("estado público da peça", () => {
  it("peça completa é comprável", () => {
    const s = productPublicState(produto());
    expect(s.state).toBe("disponivel");
    expect(s.comprable).toBe(true);
  });

  it("sem preço confirmado vira consulta de preço", () => {
    const s = productPublicState(produto({ compravel: false, precoConfirmado: false }));
    expect(s.state).toBe("consultar_preco");
    expect(s.comprable).toBe(false);
  });

  it("sem tamanho vira consulta de tamanho", () => {
    const s = productPublicState(produto({ compravel: false, sizes: [], stockBySize: {} }));
    expect(s.state).toBe("consultar_tamanho");
  });

  it("sem preço e sem tamanho vira consulta de disponibilidade", () => {
    const s = productPublicState(
      produto({ compravel: false, precoConfirmado: false, sizes: [], stockBySize: {} }),
    );
    expect(s.state).toBe("consultar_disponibilidade");
  });

  it("comprável sem saldo é esgotado", () => {
    const s = productPublicState(produto({ stock: 0, stockBySize: { M: 0 } }));
    expect(s.state).toBe("esgotado");
    expect(s.comprable).toBe(false);
  });
});

describe("mensagem de consulta", () => {
  it("nunca imprime valores inválidos", () => {
    const msg = buildConsultaMessage(
      produto({ compravel: false, precoConfirmado: false, price: 0, sizes: [], stockBySize: {} }),
    );
    expect(msg).not.toMatch(/NaN|undefined|null|R\$\s?0,00/);
    expect(msg).toContain("Tamanho: Sob consulta");
    expect(msg).toContain("Preço: Sob consulta");
  });

  it("usa o tamanho escolhido quando informado", () => {
    const msg = buildConsultaMessage(produto({ compravel: false, precoConfirmado: false }), "G");
    expect(msg).toContain("Tamanho: G");
    expect(msg).toContain("Gostaria de confirmar o valor desta peça.");
  });

  it("monta link no número oficial da loja", () => {
    const url = buildConsultaUrl("(54) 99999-1234", produto({ compravel: false }));
    expect(url.startsWith("https://wa.me/54999991234?text=")).toBe(true);
  });
});
