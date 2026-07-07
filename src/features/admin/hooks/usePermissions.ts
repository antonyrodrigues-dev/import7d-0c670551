/**
 * Autorização centralizada do painel administrativo.
 *
 * Único ponto onde componentes verificam se o usuário pode ver / editar.
 * Nenhum componente pode chamar `supabase.auth.getUser()` para decidir
 * permissões — devem consumir este hook.
 */

import { useEffect } from "react";
import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_PERMISSIONS } from "../constants";
import type { EmployeeRole, Permission } from "../types";

interface PermissionsState {
  ready: boolean;
  roles: EmployeeRole[];
  userId: string | null;
  hydrate: () => Promise<void>;
  clear: () => void;
}

// Mapeia papéis vindos do banco (`admin`, `atendente`) para o vocabulário
// oficial do módulo administrativo (`admin`, `vendedor`).
function mapDbRole(dbRole: string): EmployeeRole | null {
  if (dbRole === "admin") return "admin";
  if (dbRole === "atendente" || dbRole === "vendedor") return "vendedor";
  return null;
}

const useStore = create<PermissionsState>((set) => ({
  ready: false,
  roles: [],
  userId: null,
  hydrate: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      set({ ready: true, roles: [], userId: null });
      return;
    }
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (data ?? [])
      .map((r) => mapDbRole(String(r.role)))
      .filter((r): r is EmployeeRole => Boolean(r));
    set({ ready: true, roles, userId: user.id });
  },
  clear: () => set({ ready: false, roles: [], userId: null }),
}));

export function usePermissions() {
  const state = useStore();
  useEffect(() => {
    if (!state.ready) void state.hydrate();
  }, [state]);

  const allPermissions = new Set<Permission>(
    state.roles.flatMap((r) => ROLE_PERMISSIONS[r] ?? []),
  );

  return {
    ready: state.ready,
    userId: state.userId,
    roles: state.roles,
    isAdmin: state.roles.includes("admin"),
    isVendedor: state.roles.includes("vendedor") && !state.roles.includes("admin"),
    can: (permission: Permission): boolean => allPermissions.has(permission),
    reset: state.clear,
  };
}