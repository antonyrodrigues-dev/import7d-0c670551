/**
 * Serviço de clientes administrativos.
 * Deriva a lista de clientes dos pedidos existentes. Quando houver tabela
 * dedicada `clientes`, basta trocar a origem sem alterar a UI.
 */

import type { AdminCustomer, AdminOrder } from "../types";

export function deriveCustomersFromOrders(orders: AdminOrder[]): AdminCustomer[] {
  const byPhone = new Map<string, AdminCustomer>();
  for (const o of orders) {
    const key = o.cliente.telefone || o.cliente.nome;
    const existing = byPhone.get(key);
    if (existing) {
      existing.pedidos += 1;
      existing.valorGasto += o.valorTotal;
      if (!existing.ultimaCompra || o.criadoEm > existing.ultimaCompra) {
        existing.ultimaCompra = o.criadoEm;
      }
    } else {
      byPhone.set(key, {
        id: key,
        nome: o.cliente.nome,
        telefone: o.cliente.telefone,
        cidade: "—",
        pedidos: 1,
        ultimaCompra: o.criadoEm,
        valorGasto: o.valorTotal,
        status: "ativo",
      });
    }
  }
  return Array.from(byPhone.values()).sort((a, b) => b.valorGasto - a.valorGasto);
}