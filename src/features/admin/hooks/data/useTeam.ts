import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useTeamStore } from "../../stores/ops";
import {
  groupTeam,
  listTeam,
  setMemberActive,
  setMemberRole,
  toUiRole,
} from "../../services/ops/team.service";
import { usePermissions } from "../usePermissions";
import { useOpsRealtime } from "./useOpsRealtime";
import type { EmployeeRole } from "../../types";

/** Equipe: aguardando liberação, ativos e inativos. Só Admin Master lê. */
export function useTeam() {
  const { isAdmin, ready, userId } = usePermissions();
  const { state, members, setState, set } = useTeamStore();

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    setState("loading");
    set(await listTeam());
  }, [isAdmin, set, setState]);

  useEffect(() => {
    if (ready && isAdmin && state === "idle") void refresh();
  }, [ready, isAdmin, state, refresh]);

  // Alterações de perfil/cargo aparecem em tempo real para o Admin Master.
  useOpsRealtime(() => void refresh(), Boolean(isAdmin));

  const setActive = useCallback(
    async (targetId: string, ativo: boolean) => {
      setState("saving");
      const ok = await setMemberActive(targetId, ativo);
      if (ok) toast.success(ativo ? "Funcionário ativado." : "Funcionário inativado.");
      await refresh();
      return ok;
    },
    [refresh, setState],
  );

  const setRole = useCallback(
    async (targetId: string, role: EmployeeRole) => {
      setState("saving");
      const ok = await setMemberRole(targetId, role);
      if (ok) toast.success("Cargo atualizado.");
      await refresh();
      return ok;
    },
    [refresh, setState],
  );

  return {
    state,
    members,
    groups: groupTeam(members),
    currentUserId: userId,
    allowed: isAdmin,
    ready,
    refresh,
    setActive,
    setRole,
    toUiRole,
  };
}
