/**
 * 7D IMPORTS — Transações administrativas.
 *
 * Uma "transação" empacota uma mutação que pode tocar múltiplas stores
 * (pedidos → estoque → notificações → logs). Se qualquer etapa falhar,
 * `runAdminTransaction` restaura os snapshots iniciais e registra o erro.
 *
 * Não substitui uma transação de banco (não existe atomicidade real em
 * localStorage), mas garante que a UI nunca fique em estado parcial.
 */

import { useOrdersStore } from "../stores/orders";
import { useInventoryStore } from "../stores/inventory";
import { useNotificationsStore } from "../stores/notifications";
import { useCustomersStore } from "../stores/customers";
import { useDashboardStore } from "../stores/dashboard";
import { useSettingsStore } from "../stores/settings";
import { logger } from "./logger";
import { handleAdminError, createAdminError } from "./errors";
import type { AdminError } from "./errors";

export interface AdminSnapshot {
  at: string;
  orders: ReturnType<typeof useOrdersStore.getState>;
  inventory: ReturnType<typeof useInventoryStore.getState>;
  notifications: ReturnType<typeof useNotificationsStore.getState>;
  customers: ReturnType<typeof useCustomersStore.getState>;
  dashboard: ReturnType<typeof useDashboardStore.getState>;
  settings: ReturnType<typeof useSettingsStore.getState>;
}

/** Captura o estado atual de todas as stores. Cópia rasa — suficiente porque
 *  mutações fazem `set({...})` imutável, então referências antigas são estáveis. */
export function captureAdminSnapshot(): AdminSnapshot {
  return {
    at: new Date().toISOString(),
    orders: useOrdersStore.getState(),
    inventory: useInventoryStore.getState(),
    notifications: useNotificationsStore.getState(),
    customers: useCustomersStore.getState(),
    dashboard: useDashboardStore.getState(),
    settings: useSettingsStore.getState(),
  };
}

export function restoreAdminSnapshot(snap: AdminSnapshot): void {
  useOrdersStore.setState(snap.orders, false);
  useInventoryStore.setState(snap.inventory, false);
  useNotificationsStore.setState(snap.notifications, false);
  useCustomersStore.setState(snap.customers, false);
  useDashboardStore.setState(snap.dashboard, false);
  useSettingsStore.setState(snap.settings, false);
}

export interface TransactionOptions {
  /** Nome descritivo (aparece em logs). */
  name: string;
  /** Origem lógica (Service que a executou). */
  origin: string;
}

export type TransactionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AdminError };

/**
 * Executa uma operação envolvendo várias stores com rollback automático em
 * caso de erro. A operação recebe o snapshot inicial (para inspeção) e pode
 * ser async.
 */
export async function runAdminTransaction<T>(
  options: TransactionOptions,
  operation: (snapshot: AdminSnapshot) => Promise<T> | T,
): Promise<TransactionResult<T>> {
  const snapshot = captureAdminSnapshot();
  const started = performance.now();
  try {
    const value = await operation(snapshot);
    const elapsed = Math.round(performance.now() - started);
    logger.info(`tx:${options.name} ok`, { origin: options.origin, ms: elapsed });
    return { ok: true, value };
  } catch (e) {
    restoreAdminSnapshot(snapshot);
    const err = handleAdminError(
      e instanceof Error
        ? createAdminError("rollback", `Rollback aplicado: ${e.message}`, options.origin, {
            cause: e,
          })
        : e,
      options.origin,
    );
    logger.warn(`tx:${options.name} rollback`, {
      origin: options.origin,
      message: err.message,
    });
    return { ok: false, error: err };
  }
}