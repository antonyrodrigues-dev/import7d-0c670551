import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminNotification } from "../types";
import { loadInitialNotifications } from "../services/notifications.service";

interface NotificationsStore {
  notifications: AdminNotification[];
  push: (n: Omit<AdminNotification, "id" | "createdAt" | "read"> & { id?: string }) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
  hydrate: () => void;
}

export const useNotificationsStore = create<NotificationsStore>()(
  persist(
    (set, get) => ({
      notifications: [],
      push: (n) =>
        set((s) => ({
          notifications: [
            {
              id: n.id ?? crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              read: false,
              priority: n.priority ?? "media",
              kind: n.kind,
              title: n.title,
              body: n.body,
            },
            ...s.notifications,
          ],
        })),
      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      markAllRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      clear: () => set({ notifications: [] }),
      hydrate: () => {
        if (get().notifications.length === 0) {
          set({ notifications: loadInitialNotifications() });
        }
      },
    }),
    { name: "7d-admin-notifications" },
  ),
);