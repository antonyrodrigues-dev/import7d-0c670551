/**
 * Serviço de clientes administrativos.
 * Deriva a lista de clientes dos pedidos existentes. Quando houver tabela
 * dedicada `clientes`, basta trocar a origem sem alterar a UI.
 */

import type { AdminCustomer, AdminOrder, CustomerOrderRef } from "../types";

export function deriveCustomersFromOrders(orders: AdminOrder[]): AdminCustomer[] {
  const byPhone = new Map<string, AdminCustomer>();
  for (const o of orders) {
    const key = o.cliente.telefone || o.cliente.nome;
    const ref: CustomerOrderRef = {
      id: o.id,
      numero: o.numero,
      criadoEm: o.criadoEm,
      valorTotal: o.valorTotal,
    };
    const existing = byPhone.get(key);
    if (existing) {
      existing.pedidos += 1;
      existing.valorGasto += o.valorTotal;
      existing.historico.push(ref);
      if (!existing.ultimaCompra || o.criadoEm > existing.ultimaCompra) {
        existing.ultimaCompra = o.criadoEm;
      }
    } else {
      byPhone.set(key, {
        id: key,
        nome: o.cliente.nome,
        telefone: o.cliente.telefone,
        cidade: o.cliente.cidade ?? "—",
        historico: [ref],
        pedidos: 1,
        ultimaCompra: o.criadoEm,
        valorGasto: o.valorTotal,
        status: "ativo",
      });
    }
  }
  return Array.from(byPhone.values()).sort((a, b) => b.valorGasto - a.valorGasto);
}