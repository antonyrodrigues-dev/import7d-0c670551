import { useEffect } from "react";
import { useOrdersStore } from "../../stores/orders";
import { useCustomersStore } from "../../stores/customers";
import { deriveCustomersFromOrders } from "../../services/customers.service";

/**
 * Fonte única de clientes. Derivada dos pedidos até existir persistência
 * dedicada. UI consome sempre daqui — nunca calcula sozinha.
 */
export function useCustomers() {
  const orders = useOrdersStore((s) => s.orders);
  const setCustomers = useCustomersStore((s) => s.set);
  const store = useCustomersStore();
  useEffect(() => {
    setCustomers(deriveCustomersFromOrders(orders));
  }, [orders, setCustomers]);
  return store;
}
