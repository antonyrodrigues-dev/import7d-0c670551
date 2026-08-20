/**
 * 7D IMPORTS — Ciclo de vida da sessão administrativa.
 *
 * Fonte única de limpeza de estado. Qualquer troca de conta (SIGNED_IN,
 * SIGNED_OUT, USER_UPDATED) passa por aqui: nenhuma tela pode exibir dados
 * do usuário anterior, nem manter subscriptions Realtime órfãs.
 */

import type { QueryClient } from "@tanstack/react-query";
import { teardownOpsRealtime } from "../adapters/ops";
import { teardownInventoryRealtime } from "../adapters/lovableCloud";
import { resetOpsStores } from "../stores/ops";
import { useOrdersStore } from "../stores/orders";
import { useInventoryStore } from "../stores/inventory";
import { useCustomersStore } from "../stores/customers";
import { useEmployeesStore } from "../stores/employees";
import { useDashboardStore } from "../stores/dashboard";
import { useNotificationsStore } from "../stores/notifications";

/**
 * Limpa TODO o estado administrativo em memória e derruba o Realtime.
 * A ordem importa: primeiro derrubamos as assinaturas (para não repovoar
 * stores durante a limpeza), depois zeramos os dados.
 */
export function resetAdminSession(queryClient?: QueryClient): void {
  teardownOpsRealtime();
  teardownInventoryRealtime();

  resetOpsStores();
  useOrdersStore.setState({ orders: [], state: "idle", error: null });
  useInventoryStore.setState({ items: [], state: "idle" });
  useCustomersStore.setState({ customers: [], state: "idle" });
  useEmployeesStore.setState({ employees: [], state: "idle", error: null });
  useDashboardStore.setState({ metrics: null, loading: false });
  useNotificationsStore.getState().clear();

  queryClient?.clear();
}
