/**
 * 7D IMPORTS — Auditoria estrutural do painel administrativo.
 *
 * Executado no boot do shell: verifica invariantes da arquitetura
 * (adapter presente, stores acessíveis, hooks/services carregáveis,
 * eventBus operacional). Não substitui testes — é um smoke test em runtime.
 *
 * Retorna `"Admin Architecture OK"` ou `"Architecture Issues Found"` com a
 * lista de problemas, ambos registrados no logger.
 */

import { adminDataSource } from "../adapters";
import { useOrdersStore } from "../stores/orders";
import { useInventoryStore } from "../stores/inventory";
import { useCustomersStore } from "../stores/customers";
import { useEmployeesStore } from "../stores/employees";
import { useNotificationsStore } from "../stores/notifications";
import { useDashboardStore } from "../stores/dashboard";
import { useSettingsStore } from "../stores/settings";
import { useLogsStore } from "../stores/logs";
import { emit, subscribe, _clearAllListeners } from "./eventBus";
import { logger } from "./logger";

export interface AuditResult {
  ok: boolean;
  status: "Admin Architecture OK" | "Architecture Issues Found";
  issues: string[];
}

export function auditAdminArchitecture(): AuditResult {
  const issues: string[] = [];

  // Adapter
  if (!adminDataSource || typeof adminDataSource.listOrders !== "function") {
    issues.push("adapter: dataSource ausente ou incompleto");
  }

  // Stores presentes
  const stores = [
    ["orders", useOrdersStore],
    ["inventory", useInventoryStore],
    ["customers", useCustomersStore],
    ["employees", useEmployeesStore],
    ["notifications", useNotificationsStore],
    ["dashboard", useDashboardStore],
    ["settings", useSettingsStore],
    ["logs", useLogsStore],
  ] as const;
  for (const [name, s] of stores) {
    try {
      if (!s.getState()) issues.push(`store:${name} não inicializada`);
    } catch {
      issues.push(`store:${name} inacessível`);
    }
  }

  // EventBus operacional
  try {
    let received = false;
    const off = subscribe("order.created", () => {
      received = true;
    });
    emit("order.created", { orderId: "__audit__", numero: "__audit__" });
    off();
    if (!received) issues.push("eventBus: emissão/assinatura falhou");
  } catch {
    issues.push("eventBus: exceção durante smoke test");
    _clearAllListeners();
  }

  const ok = issues.length === 0;
  const status = ok ? "Admin Architecture OK" : "Architecture Issues Found";
  if (ok) {
    logger.info(status);
  } else {
    logger.warn(status, { issues });
  }
  return { ok, status, issues };
}