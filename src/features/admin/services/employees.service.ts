/**
 * Serviço de funcionários — camada única entre UI e o dataSource.
 * Consumidores devem antes verificar `usePermissions().can("employees:view")`.
 */

import { adminDataSource } from "../adapters";
import type { Employee } from "../types";

export function listEmployees(): Promise<Employee[]> {
  return adminDataSource.listEmployees();
}
