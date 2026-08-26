import { describe, expect, it } from "vitest";
import { validateReturn } from "@/features/admin/services/ops/returns.service";
import { RETURN_CONDITIONS, RETURN_REASONS, returnConditionLabel } from "@/features/admin/types";
import type { ReturnInput } from "@/features/admin/types";

const base = (over: Partial<ReturnInput> = {}): ReturnInput => ({
  pedidoId: "p1",
  itens: [{ slug: "polo-x", size: "M", quantity: 1, condicao: "vendavel" }],
  motivo: "arrependimento",
  valorEstornado: 0,
  ...over,
});

describe("devolução: motivo comercial ≠ condição física", () => {
  it("UI oferece somente as 4 condições físicas canônicas", () => {
    expect(RETURN_CONDITIONS.map((c) => c.key)).toEqual([
      "vendavel",
      "usada",
      "avariada",
      "defeituosa",
    ]);
  });

  it("motivos comerciais permanecem separados e completos", () => {
    expect(RETURN_REASONS.map((r) => r.key)).toEqual([
      "arrependimento",
      "tamanho/cor divergente",
      "defeito alegado",
      "erro no envio",
      "outro",
    ]);
  });

  it("motivo divergente + condição vendável é válido (volta ao estoque)", () => {
    expect(validateReturn(base({ motivo: "tamanho/cor divergente" }))).toBeNull();
  });

  it("motivo outro descrito + condição vendável é válido", () => {
    expect(validateReturn(base({ motivo: "cliente desistiu na entrega" }))).toBeNull();
  });

  it("motivo 'outro' sem descrição é rejeitado", () => {
    expect(validateReturn(base({ motivo: "outro" }))).toMatch(/descreva/i);
  });

  it("condição avariada é válida (quarentena)", () => {
    expect(
      validateReturn(
        base({ itens: [{ slug: "polo-x", size: "M", quantity: 1, condicao: "avariada" }] }),
      ),
    ).toBeNull();
  });

  it("condições legadas nunca podem ser enviadas em nova devolução", () => {
    for (const legacy of ["divergencia", "outra"]) {
      const input = base({
        itens: [
          { slug: "polo-x", size: "M", quantity: 1, condicao: legacy as never },
        ],
      });
      expect(validateReturn(input)).toMatch(/condição física inválida/i);
    }
  });

  it("histórico legado continua legível", () => {
    expect(returnConditionLabel("divergencia")).toBe("Divergência (legado)");
    expect(returnConditionLabel("outra")).toBe("Outra (legado)");
    expect(returnConditionLabel("vendavel")).toBe("Vendável");
  });
});
