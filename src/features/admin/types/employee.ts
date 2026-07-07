import type { IsoDateTime } from "./common";

/** Papéis oficiais — nunca usar strings soltas fora deste enum. */
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