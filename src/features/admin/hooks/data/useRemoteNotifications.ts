import { useCallback, useEffect } from "react";
import { useRemoteNotificationsStore } from "../../stores/ops";
import {
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from "../../services/ops/notifications.remote.service";
import { usePermissions } from "../usePermissions";
import { useOpsRealtime } from "./useOpsRealtime";

/** Notificações persistentes, com leitura por usuário e sincronia realtime. */
export function useRemoteNotifications() {
  const { userId, ready } = usePermissions();
  const store = useRemoteNotificationsStore();
  const { setState, set } = store;

  const refresh = useCallback(async () => {
    if (!userId) return;
    setState("loading");
    set(await listNotifications(userId));
  }, [userId, set, setState]);

  useEffect(() => {
    if (ready && userId) void refresh();
  }, [ready, userId, refresh]);

  useOpsRealtime(() => void refresh(), Boolean(userId));

  const marcarLida = useCallback(
    async (id: string) => {
      if (!userId) return;
      useRemoteNotificationsStore.getState().markRead(id);
      await markRead(id, userId);
    },
    [userId],
  );

  const marcarTodasLidas = useCallback(async () => {
    if (!userId) return;
    const ids = useRemoteNotificationsStore
      .getState()
      .items.filter((n) => !n.lido)
      .map((n) => n.id);
    useRemoteNotificationsStore.getState().markAllRead();
    await markAllRead(ids, userId);
  }, [userId]);

  return {
    state: store.state,
    items: store.items,
    naoLidas: unreadCount(store.items),
    refresh,
    marcarLida,
    marcarTodasLidas,
  };
}
