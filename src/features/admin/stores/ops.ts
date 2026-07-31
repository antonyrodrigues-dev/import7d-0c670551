/**
 * Stores da camada operacional (Onda 0).
 *
 * Estado derivado do backend — nada de regra de negócio aqui. Cada store
 * carrega o estado assíncrono padrão (`AdminAsyncState`) para que a UI
 * apresente loading, sucesso, vazio e erro de forma uniforme.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AdminAsyncState,
  FinanceMetrics,
  FinancePeriod,
  OperationalParams,
  QueueOrder,
  RemoteNotification,
  TeamMember,
} from "../types";
import { DEFAULT_PARAMS } from "../types";

interface QueueStore {
  state: AdminAsyncState;
  fila: QueueOrder[];
  emAtendimento: QueueOrder[];
  atualizadoEm: string | null;
  setState: (s: AdminAsyncState) => void;
  set: (fila: QueueOrder[], emAtendimento: QueueOrder[]) => void;
  clear: () => void;
}

export const useQueueStore = create<QueueStore>((set) => ({
  state: "idle",
  fila: [],
  emAtendimento: [],
  atualizadoEm: null,
  setState: (state) => set({ state }),
  set: (fila, emAtendimento) =>
    set({
      fila,
      emAtendimento,
      atualizadoEm: new Date().toISOString(),
      state: fila.length + emAtendimento.length === 0 ? "empty" : "ready",
    }),
  clear: () => set({ state: "idle", fila: [], emAtendimento: [], atualizadoEm: null }),
}));

interface TeamStore {
  state: AdminAsyncState;
  members: TeamMember[];
  setState: (s: AdminAsyncState) => void;
  set: (m: TeamMember[]) => void;
  clear: () => void;
}

export const useTeamStore = create<TeamStore>((set) => ({
  state: "idle",
  members: [],
  setState: (state) => set({ state }),
  set: (members) => set({ members, state: members.length === 0 ? "empty" : "ready" }),
  clear: () => set({ state: "idle", members: [] }),
}));

interface ParamsStore {
  state: AdminAsyncState;
  params: OperationalParams;
  setState: (s: AdminAsyncState) => void;
  set: (p: OperationalParams) => void;
  clear: () => void;
}

/** Parâmetros ficam em cache local apenas como fallback offline. */
export const useParamsStore = create<ParamsStore>()(
  persist(
    (set) => ({
      state: "idle",
      params: { ...DEFAULT_PARAMS },
      setState: (state) => set({ state }),
      set: (params) => set({ params, state: "ready" }),
      clear: () => set({ state: "idle", params: { ...DEFAULT_PARAMS } }),
    }),
    { name: "7d-admin-params", partialize: (s) => ({ params: s.params }) },
  ),
);

interface RemoteNotificationsStore {
  state: AdminAsyncState;
  items: RemoteNotification[];
  setState: (s: AdminAsyncState) => void;
  set: (items: RemoteNotification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useRemoteNotificationsStore = create<RemoteNotificationsStore>((set) => ({
  state: "idle",
  items: [],
  setState: (state) => set({ state }),
  set: (items) => set({ items, state: items.length === 0 ? "empty" : "ready" }),
  markRead: (id) =>
    set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, lido: true } : n)) })),
  markAllRead: () => set((s) => ({ items: s.items.map((n) => ({ ...n, lido: true })) })),
  clear: () => set({ state: "idle", items: [] }),
}));

interface FinanceOpsStore {
  state: AdminAsyncState;
  period: FinancePeriod;
  metrics: FinanceMetrics | null;
  setPeriod: (p: FinancePeriod) => void;
  setState: (s: AdminAsyncState) => void;
  set: (m: FinanceMetrics | null) => void;
  clear: () => void;
}

/** Só o filtro de período é persistido; métricas sempre vêm do servidor. */
export const useFinanceOpsStore = create<FinanceOpsStore>()(
  persist(
    (set) => ({
      state: "idle",
      period: "30d",
      metrics: null,
      setPeriod: (period) => set({ period }),
      setState: (state) => set({ state }),
      set: (metrics) => set({ metrics, state: metrics ? "ready" : "empty" }),
      clear: () => set({ state: "idle", metrics: null }),
    }),
    { name: "7d-admin-finance-ui", partialize: (s) => ({ period: s.period }) },
  ),
);

/** Limpa TODO o estado operacional — usado na troca de conta / logout. */
export function resetOpsStores(): void {
  useQueueStore.getState().clear();
  useTeamStore.getState().clear();
  useParamsStore.getState().clear();
  useRemoteNotificationsStore.getState().clear();
  useFinanceOpsStore.getState().clear();
}