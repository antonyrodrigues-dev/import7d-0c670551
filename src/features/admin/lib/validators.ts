/**
 * 7D IMPORTS — Validators centralizados do painel admin.
 *
 * Regras que nenhum componente pode reimplementar. Retorno padrão:
 *   { ok: boolean; errors: string[] }.
 */

import type { AdminCustomer, AdminOrder, Employee, InventoryItem, OrderStatus } from "../types";
import { canTransition } from "./statusMachine";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function fail(errors: string[]): ValidationResult {
  return { ok: false, errors };
}
function pass(): ValidationResult {
  return { ok: true, errors: [] };
}

export function validateOrder(order: AdminOrder): ValidationResult {
  const errors: string[] = [];
  if (!order.cliente?.nome) errors.push("Cliente sem nome.");
  if (!order.cliente?.telefone) errors.push("Cliente sem telefone.");
  if (!order.itens?.length) errors.push("Pedido sem itens.");
  if (order.itens?.some((i) => i.quantity <= 0)) errors.push("Item com quantidade inválida.");
  if (!order.pagamento?.metodo) errors.push("Forma de pagamento ausente.");
  if (order.entrega === "entrega" && !order.endereco) errors.push("Entrega sem endereço.");
  if (order.entrega === "retirada" && !order.retirada) errors.push("Retirada sem horário.");
  if (order.valorTotal <= 0) errors.push("Valor total inválido.");
  return errors.length ? fail(errors) : pass();
}

export function validateStatusTransition(from: OrderStatus, to: OrderStatus): ValidationResult {
  return canTransition(from, to) ? pass() : fail([`Transição inválida: ${from} → ${to}.`]);
}

export function validateCustomer(c: AdminCustomer): ValidationResult {
  const errors: string[] = [];
  if (!c.nome?.trim()) errors.push("Nome obrigatório.");
  if (!c.telefone?.trim()) errors.push("Telefone obrigatório.");
  return errors.length ? fail(errors) : pass();
}

export function validateInventoryItem(i: InventoryItem): ValidationResult {
  const errors: string[] = [];
  if (!i.name) errors.push("Produto sem nome.");
  if (!i.sku) errors.push("Produto sem SKU.");
  if (i.price < 0) errors.push("Preço não pode ser negativo.");
  if (i.quantity < 0) errors.push("Quantidade não pode ser negativa.");
  if (i.stockBySize.some((s) => s.quantity < 0))
    errors.push("Estoque por tamanho não pode ser negativo.");
  return errors.length ? fail(errors) : pass();
}

export function validateStockChange(
  item: InventoryItem,
  size: string,
  delta: number,
): ValidationResult {
  const row = item.stockBySize.find((s) => s.size === size);
  if (!row) return fail([`Tamanho ${size} não encontrado.`]);
  if (row.quantity + delta < 0) return fail(["Estoque insuficiente."]);
  return pass();
}

export function validateEmployee(e: Employee): ValidationResult {
  const errors: string[] = [];
  if (!e.nome?.trim()) errors.push("Nome obrigatório.");
  if (!e.login?.trim()) errors.push("Login obrigatório.");
  return errors.length ? fail(errors) : pass();
}
