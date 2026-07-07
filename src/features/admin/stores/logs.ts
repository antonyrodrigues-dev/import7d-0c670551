/**
 * 7D IMPORTS — Camada mínima de auditoria interna.
 *
 * Registra eventos operacionais (pedido, estoque, configurações, login).
 * Persistida localmente hoje; preparada para envio a backend no futuro
 * (basta substituir `persist` por um adapter de rede).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IsoDateTime } from "../types";

export type LogKind =
  | "order.created"
  | "order.status"
  | "order.error"
  | "stock.in"
  | "stock.out"
  | "stock.adjust"
  | "stock.restock"
  | "settings.update"
  | "auth.login"
  | "auth.logout"
  | "system.error";

export interface AuditLog {
  id: string;
  at: IsoDateTime;
  kind: LogKind;
  message: string;
  meta?: Record<string, unknown>;
}

interface LogsStore {
  logs: AuditLog[];
  push: (kind: LogKind, message: string, meta?: Record<string, unknown>) => void;
  clear: () => void;
}

const MAX_LOGS = 500;

export const useLogsStore = create<LogsStore>()(
  persist(
    (set) => ({
      logs: [],
      push: (kind, message, meta) =>
        set((s) => ({
          logs: [
            {
              id: crypto.randomUUID(),
              at: new Date().toISOString(),
              kind,
              message,
              meta,
            },
            ...s.logs,
          ].slice(0, MAX_LOGS),
        })),
      clear: () => set({ logs: [] }),
    }),
    { name: "7d-admin-logs" },
  ),
);

export function logEvent(
  kind: LogKind,
  message: string,
  meta?: Record<string, unknown>,
): void {
  useLogsStore.getState().push(kind, message, meta);
}
