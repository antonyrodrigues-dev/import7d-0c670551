/**
 * Autorização centralizada do painel administrativo.
 *
 * Único ponto onde componentes verificam se o usuário pode ver / editar.
 * Nenhum componente consulta a origem de dados diretamente — vai por aqui.
 */

import { useEffect } from "react";
import { create } from "zustand";
import { adminDataSource } from "../adapters";
import { ROLE_PERMISSIONS } from "../constants";
import type { EmployeeRole, Permission } from "../types";

interface PermissionsState {
  ready: boolean;
  roles: EmployeeRole[];
  userId: string | null;
  displayName: string | null;
  email: string | null;
  hydrate: () => Promise<void>;
  clear: () => void;
}

const useStore = create<PermissionsState>((set) => ({
  ready: false,
  roles: [],
  userId: null,
  displayName: null,
  email: null,
  hydrate: async () => {
    try {
      const identity = await adminDataSource.currentIdentity();
      set({
        ready: true,
        roles: identity.roles,
        userId: identity.userId,
        displayName: identity.displayName ?? null,
        email: identity.email ?? null,
      });
    } catch {
      set({ ready: true, roles: [], userId: null, displayName: null, email: null });
    }
  },
  clear: () => set({ ready: false, roles: [], userId: null, displayName: null, email: null }),
}));

export function usePermissions() {
  const state = useStore();
  useEffect(() => {
    if (!state.ready) void state.hydrate();
  }, [state]);

  const allPermissions = new Set<Permission>(state.roles.flatMap((r) => ROLE_PERMISSIONS[r] ?? []));

  return {
    ready: state.ready,
    userId: state.userId,
    displayName: state.displayName,
    email: state.email,
    roles: state.roles,
    isAdmin: state.roles.includes("admin"),
    isVendedor: state.roles.includes("vendedor") && !state.roles.includes("admin"),
    can: (permission: Permission): boolean => allPermissions.has(permission),
    reset: state.clear,
  };
}
