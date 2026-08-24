import { useCallback, useEffect, useState } from "react";
import { useCustomersStore } from "../../stores/customers";
import { listCustomers, listCustomerOrders } from "../../services/customers.service";
import type { AdminOrder } from "../../types";

export const CUSTOMERS_PAGE_SIZE = 20;

/**
 * Clientes paginados no servidor. A busca (nome, cidade ou telefone em
 * qualquer formato) é resolvida pela RPC — o navegador não filtra a base.
 */
export function useCustomers() {
  const { state, customers, total, page, query, setQuery, setPage, set, setState } =
    useCustomersStore();

  const refresh = useCallback(async () => {
    setState("loading");
    const res = await listCustomers({
      busca: query,
      offset: (page - 1) * CUSTOMERS_PAGE_SIZE,
      limit: CUSTOMERS_PAGE_SIZE,
    }).catch(() => null);
    if (res) set(res.customers, res.total);
    else setState("error");
  }, [query, page, set, setState]);

  useEffect(() => {
    const id = setTimeout(() => void refresh(), 200);
    return () => clearTimeout(id);
  }, [refresh]);

  return {
    state,
    customers,
    total,
    page,
    query,
    setQuery,
    setPage,
    refresh,
    totalPages: Math.max(1, Math.ceil(total / CUSTOMERS_PAGE_SIZE)),
  };
}

/** Histórico do cliente carregado sob demanda ao abrir o detalhe. */
export function useCustomerHistory(telefone: string | null) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!telefone) {
      setOrders([]);
      return;
    }
    let alive = true;
    setLoading(true);
    void listCustomerOrders(telefone).then((r) => {
      if (alive) {
        setOrders(r);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [telefone]);

  return { orders, loading };
}
