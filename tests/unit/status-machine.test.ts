import { describe, expect, it } from "vitest";
import { TRANSITIONS, canTransition } from "@/features/admin/lib/statusMachine";
import { ORDER_STATUSES } from "@/features/admin/constants";
import type { OrderStatus } from "@/features/admin/types";

/**
 * Espelho da tabela `public.pedido_transicoes` (autoridade final).
 * Divergência aqui = gate reprovado. Sincronizado com a migration
 * "máquina de estados oficial do pedido".
 */
const DB_TRANSITIONS: Array<[OrderStatus, OrderStatus]> = [
  ["novo", "whatsapp_declarado"],
  ["novo", "aguardando_atendimento"],
  ["novo", "em_atendimento"],
  ["novo", "cancelado"],
  ["whatsapp_declarado", "aguardando_atendimento"],
  ["whatsapp_declarado", "em_atendimento"],
  ["whatsapp_declarado", "cancelado"],
  ["aguardando_atendimento", "em_atendimento"],
  ["aguardando_atendimento", "cancelado"],
  ["em_atendimento", "aguardando_atendimento"],
  ["em_atendimento", "aguardando_pagamento"],
  ["em_atendimento", "cancelado"],
  ["aguardando_pagamento", "pagamento_confirmado"],
  ["aguardando_pagamento", "cancelado"],
  ["pagamento_confirmado", "separado"],
  ["pagamento_confirmado", "cancelado"],
  ["separado", "reservado"],
  ["separado", "aguardando_retirada"],
  ["separado", "enviado"],
  ["separado", "cancelado"],
  ["reservado", "aguardando_retirada"],
  ["reservado", "enviado"],
  ["reservado", "cancelado"],
  ["aguardando_retirada", "finalizado"],
  ["aguardando_retirada", "cancelado"],
  ["enviado", "finalizado"],
  ["enviado", "cancelado"],
  ["finalizado", "devolvido"],
];

const key = (a: string, b: string) => `${a}->${b}`;

describe("máquina de estados do pedido", () => {
  it("cobre exatamente os 13 status oficiais", () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual(ORDER_STATUSES.map((s) => s.key).sort());
  });

  it("espelha exatamente pedido_transicoes", () => {
    const ts = Object.entries(TRANSITIONS)
      .flatMap(([de, paras]) => (paras as OrderStatus[]).map((p) => key(de, p)))
      .sort();
    const db = DB_TRANSITIONS.map(([de, para]) => key(de, para)).sort();
    expect(ts).toEqual(db);
  });

  it("bloqueia atalhos não autorizados", () => {
    const proibidos: Array<[OrderStatus, OrderStatus]> = [
      ["novo", "finalizado"],
      ["novo", "separado"],
      ["novo", "reservado"],
      ["novo", "pagamento_confirmado"],
      ["em_atendimento", "pagamento_confirmado"],
      ["em_atendimento", "separado"],
      ["separado", "finalizado"],
      ["reservado", "finalizado"],
      ["cancelado", "novo"],
    ];
    for (const [de, para] of proibidos) {
      expect(canTransition(de, para), key(de, para)).toBe(false);
    }
  });

  it("permite o fluxo principal ponta a ponta", () => {
    const fluxo: OrderStatus[] = [
      "novo",
      "whatsapp_declarado",
      "aguardando_atendimento",
      "em_atendimento",
      "aguardando_pagamento",
      "pagamento_confirmado",
      "separado",
      "aguardando_retirada",
      "finalizado",
    ];
    for (let i = 0; i < fluxo.length - 1; i++) {
      expect(canTransition(fluxo[i]!, fluxo[i + 1]!), key(fluxo[i]!, fluxo[i + 1]!)).toBe(true);
    }
  });
});
