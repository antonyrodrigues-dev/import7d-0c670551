/**
 * Serviço de equipe (usuários pendentes, ativos e inativos).
 *
 * Baseado na RPC `listar_equipe()` — restrita ao Admin Master. A inativação
 * é verificada no backend: `has_role` retorna falso para perfil inativo, de
 * modo que um funcionário inativado perde acesso real a todas as RPCs
 * administrativas, mesmo com sessão aberta.
 */

import { opsDataSource } from "../../adapters/ops";
import { handleAdminError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import type { TeamMember } from "../../types";

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

export async function setMemberActive(userId: string, ativo: boolean): Promise<boolean> {
  try {
    await opsDataSource.setMemberStatus(userId, ativo ? "ativo" : "inativo");
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