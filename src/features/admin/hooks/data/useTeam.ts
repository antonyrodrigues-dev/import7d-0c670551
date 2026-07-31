import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useTeamStore } from "../../stores/ops";
import { groupTeam, listTeam, setMemberActive } from "../../services/ops/team.service";
import { usePermissions } from "../usePermissions";

/** Equipe: aguardando liberação, ativos e inativos. Só Admin Master lê. */
export function useTeam() {
  const { isAdmin, ready } = usePermissions();
  const { state, members, setState, set } = useTeamStore();

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    setState("loading");
    set(await listTeam());
  }, [isAdmin, set, setState]);

  useEffect(() => {
    if (ready && isAdmin && state === "idle") void refresh();
  }, [ready, isAdmin, state, refresh]);

  const setActive = useCallback(
    async (userId: string, ativo: boolean) => {
      setState("saving");
      const ok = await setMemberActive(userId, ativo);
      if (ok) toast.success(ativo ? "Funcionário ativado." : "Funcionário inativado.");
      await refresh();
      return ok;
    },
    [refresh, setState],
  );

  return { state, members, groups: groupTeam(members), refresh, setActive };
}