/**
 * Serviço de notificações persistentes.
 *
 * As notificações são geradas no banco por gatilhos dos eventos oficiais
 * (pedido criado, WhatsApp declarado, atendimento assumido/transferido,
 * pagamento, devolução, quarentena, reserva expirada, parâmetro alterado),
 * com `dedupe_key` único — o mesmo evento nunca gera duas notificações.
 * A leitura é por usuário; nada depende de localStorage.
 */

import { opsDataSource } from "../../adapters/ops";
import { handleAdminError } from "../../lib/errors";
import type { RemoteNotification } from "../../types";

export async function listNotifications(userId: string | null): Promise<RemoteNotification[]> {
  try {
    return await opsDataSource.listNotifications(userId);
  } catch (e) {
    handleAdminError(e, "notifications.list");
    return [];
  }
}

export async function markRead(id: string, userId: string): Promise<boolean> {
  try {
    await opsDataSource.markNotificationRead(id, userId);
    return true;
  } catch (e) {
    handleAdminError(e, "notifications.markRead");
    return false;
  }
}

export async function markAllRead(ids: string[], userId: string): Promise<boolean> {
  try {
    await opsDataSource.markAllNotificationsRead(ids, userId);
    return true;
  } catch (e) {
    handleAdminError(e, "notifications.markAllRead");
    return false;
  }
}

export function unreadCount(items: RemoteNotification[]): number {
  return items.filter((n) => !n.lido).length;
}
