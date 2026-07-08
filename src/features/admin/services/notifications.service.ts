import type { AdminNotification } from "../types";

/**
 * Origem de notificações. Fonte atual: memória local (mocks) — arquitetura
 * pronta para plugar realtime (Telegram, webhooks, etc.) sem alterar
 * consumidores.
 */
export function loadInitialNotifications(): AdminNotification[] {
  return [];
}
