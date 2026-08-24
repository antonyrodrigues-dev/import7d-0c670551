/**
 * 7D IMPORTS — Serviço de clientes.
 *
 * AUTORIDADE: a RPC `listar_clientes` (servidor). O telefone é normalizado
 * no banco — "(54) 99999-9999", "+55 54 99999-9999" e "5499999999" são o
 * MESMO cliente. O valor gasto vem do ledger (receita − estornos −
 * devoluções): pedido cancelado ou não pago vale zero.
 *
 * Nada é derivado dos pedidos no navegador.
 */

import { adminDataSource } from "../adapters";
import type { CustomersPage, CustomersPageQuery } from "../adapters/types";
import { handleAdminError } from "../lib/errors";
import type { AdminOrder } from "../types";

export function listCustomers(query: CustomersPageQuery): Promise<CustomersPage> {
  return adminDataSource.listCustomers(query).catch((e) => {
    throw handleAdminError(e, "customers.listCustomers");
  });
}

/**
 * Histórico do cliente carregado sob demanda (lazy) — só quando o detalhe
 * abre. Evita N+1 na listagem.
 */
export async function listCustomerOrders(telefone: string): Promise<AdminOrder[]> {
  try {
    const page = await adminDataSource.listOrdersPage({
      busca: telefone,
      offset: 0,
      limit: 50,
    });
    return page.orders;
  } catch (e) {
    handleAdminError(e, "customers.listCustomerOrders");
    return [];
  }
}

/** Normalização usada apenas para comparação local (espelho do banco). */
export function normalizePhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
}
