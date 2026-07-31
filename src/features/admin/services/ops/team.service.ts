/**
 * Serviço de equipe (usuários pendentes, ativos e inativos).
 *
 * Baseado na RPC `listar_equipe()` — restrita ao Admin Master. A inativação
 * é verificada no backend: `has_role` retorna falso para perfil inativo, de
 * modo que um funcionário inativado perde acesso real a todas as RPCs
 * administrativas, mesmo com sessão aberta.
 *
 * Atribuição de cargo passa pelas server functions de `employees.functions`,
 * que já protegem auto-rebaixamento e o último Admin Master.
 */

import { opsDataSource } from "../../adapters/ops";
import { handleAdminError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { changeEmployeeRole, setEmployeeStatus } from "../employees.functions";
import type { EmployeeRole, TeamMember } from "../../types";

export async function listTeam(): Promise<TeamMember[]> {
  try {
    return await opsDataSource.listTeam();
  } catch (e) {
    handleAdminError(e, "team.listTeam");
    return [];
  }
}

export function groupTeam(members: TeamMember[]) {
  return {
    aguardando: members.filter((m) => m.situacao === "aguardando_liberacao"),
    ativos: members.filter((m) => m.situacao === "ativo"),
    inativos: members.filter((m) => m.situacao === "inativo"),
  };
}

/** Papel do banco (`atendente`) traduzido para o vocabulário da UI. */
export function toUiRole(roles: string[]): EmployeeRole | null {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("atendente") || roles.includes("vendedor")) return "vendedor";
  return null;
}

export async function setMemberActive(userId: string, ativo: boolean): Promise<boolean> {
  try {
    await setEmployeeStatus({ data: { userId, status: ativo ? "ativo" : "inativo" } });
    logger.info(ativo ? "Funcionário ativado." : "Funcionário inativado.", {
      userId,
      origin: "team.service",
    });
    return true;
  } catch (e) {
    handleAdminError(e, "team.setMemberActive");
    return false;
  }
}

export async function setMemberRole(userId: string, role: EmployeeRole): Promise<boolean> {
  try {
    await changeEmployeeRole({ data: { userId, role } });
    logger.info("Cargo alterado.", { userId, role, origin: "team.service" });
    return true;
  } catch (e) {
    handleAdminError(e, "team.setMemberRole");
    return false;
  }
}
