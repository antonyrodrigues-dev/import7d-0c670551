import { useEffect } from "react";
import { useNotificationsStore } from "../../stores/notifications";

export function useAdminNotifications() {
  const store = useNotificationsStore();
  useEffect(() => {
    store.hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return store;
}
