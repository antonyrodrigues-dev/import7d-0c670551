/**
 * 7D IMPORTS — Selectors memoizados.
 *
 * Derivações reutilizáveis dos dados administrativos. A UI e o dashboard
 * consomem esses selectors em vez de percorrer arrays diretamente,
 * evitando renders desnecessárias.
 */

import { useMemo } from "react";
import { useOrdersStore } from "../stores/orders";
import { useInventoryStore } from "../stores/inventory";
import { useNotificationsStore } from "../stores/notifications";
import { LOW_STOCK_THRESHOLD } from "../constants";
import type { AdminNotification, AdminOrder, InventoryItem, OrderStatus } from "../types";

const PENDING_STATUSES: OrderStatus[] = [
  "novo",
  "separado",
  "reservado",
  "aguardando_retirada",
  "enviado",
];

export function selectPendingOrders(orders: AdminOrder[]): AdminOrder[] {
  return orders.filter((o) => PENDING_STATUSES.includes(o.status));
}

export function selectTodayRevenue(orders: AdminOrder[]): number {
  const now = new Date();
  return orders
    .filter((o) => o.status === "finalizado")
    .filter((o) => {
      const d = new Date(o.criadoEm);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    })
    .reduce((a, o) => a + o.valorTotal, 0);
}

export function selectLowStock(items: InventoryItem[]): InventoryItem[] {
  return items.filter((i) => i.quantity <= LOW_STOCK_THRESHOLD);
}

export function selectUnreadNotifications(list: AdminNotification[]): AdminNotification[] {
  return list.filter((n) => !n.read);
}

/* ---------- Hooks memoizados (uso em componentes) ---------- */

export function usePendingOrders(): AdminOrder[] {
  const orders = useOrdersStore((s) => s.orders);
  return useMemo(() => selectPendingOrders(orders), [orders]);
}

export function useTodayRevenue(): number {
  const orders = useOrdersStore((s) => s.orders);
  return useMemo(() => selectTodayRevenue(orders), [orders]);
}

export function useLowStockItems(): InventoryItem[] {
  const items = useInventoryStore((s) => s.items);
  return useMemo(() => selectLowStock(items), [items]);
}

export function useUnreadNotifications(): AdminNotification[] {
  const list = useNotificationsStore((s) => s.notifications);
  return useMemo(() => selectUnreadNotifications(list), [list]);
}