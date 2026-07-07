import type { AdminNotification } from "../types";

/**
 * Origem de notificações. Fonte atual: memória local (mocks) — arquitetura
 * pronta para plugar realtime (Supabase Realtime, Telegram Bot API, etc.)
 * sem alterar consumidores.
 */
export function loadInitialNotifications(): AdminNotification[] {
  return [
    {
      id: "welcome",
      kind: "aviso",
      title: "Painel administrativo pronto",
      body: "A base do módulo Admin foi consolidada. Integrações realtime chegam nos próximos sprints.",
      createdAt: new Date().toISOString(),
      read: false,
    },
  ];
}