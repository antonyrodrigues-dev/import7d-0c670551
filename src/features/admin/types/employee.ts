import type { IsoDateTime } from "./common";

/**
 * Papéis oficiais da APLICAÇÃO — nunca usar strings soltas fora deste enum.
 *
 * ⚠️ MAPEAMENTO COM O BANCO (FIN-09)
 * O tipo `app_role` no Postgres usa nomes ligeiramente diferentes:
 *   Aplicação (UI)   ↔  Banco (app_role)
 *   "admin"          ↔  "admin"
 *   "vendedor"       ↔  "atendente"
 *
 * A conversão vive em dois pontos, e SOMENTE nesses dois pontos:
 *   - `src/features/admin/services/employees.functions.ts` → `toDbRole`
 *   - `src/features/admin/adapters/lovableCloud.ts`        → `mapDbRole`
 *
 * Se um novo papel for adicionado, atualize as duas funções + este comentário.
 */
export enum EmployeeRoleEnum {
  AdminMaster = "admin",
  Vendedor = "vendedor",
}

export type EmployeeRole = `${EmployeeRoleEnum}`;

export type EmployeeStatus = "ativo" | "inativo";

export interface Employee {
  id: string;
  nome: string;
  login: string;
  email?: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  ultimoAcesso: IsoDateTime | null;
  criadoEm: IsoDateTime;
  /** @deprecated usar `status === "ativo"` */
  ativo?: boolean;
}