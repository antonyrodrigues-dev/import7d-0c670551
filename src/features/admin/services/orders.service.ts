/**
 * Serviço de pedidos administrativos — camada única entre stores/UI e o
 * dataSource. Não conhece qual backend está por trás; delega ao adapter.
 */

import { adminDataSource } from "../adapters";
import type { AdminOrder, OrderStatus } from "../types";

export function listOrders(): Promise<AdminOrder[]> {
  return adminDataSource.listOrders();
}

export function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  return adminDataSource.updateOrderStatus(id, status);
}
