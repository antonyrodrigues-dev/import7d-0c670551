import type { AdminNotification } from "../types";
import { useNotificationsStore } from "../stores/notifications";

/**
 * Origem de notificações. Fonte atual: memória local — arquitetura pronta
 * para plugar realtime (Telegram, webhooks) sem alterar consumidores.
 */
export function loadInitialNotifications(): AdminNotification[] {
  return [];
}

/**
 * Ponto de entrada canônico. Toda notificação — de qualquer domínio — deve
 * ser criada por aqui. Nunca pela UI, nunca chamando a store diretamente.
 */
export function notify(
  n: Omit<AdminNotification, "id" | "createdAt" | "read"> & { id?: string },
): void {
  useNotificationsStore.getState().push(n);
}
