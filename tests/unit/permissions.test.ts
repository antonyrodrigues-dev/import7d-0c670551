import { describe, expect, it } from "vitest";
import { ADMIN_NAV, ADMIN_NAV_PERMISSION, ROLE_PERMISSIONS } from "@/features/admin/constants";
import type { EmployeeRole, Permission } from "@/features/admin/types";

function can(roles: EmployeeRole[], permission: Permission): boolean {
  return roles.some((r) => (ROLE_PERMISSIONS[r] ?? []).includes(permission));
}

describe("matriz de permissões — autoridade única de autorização", () => {
  it("todo item de menu exige uma permissão declarada", () => {
    for (const item of ADMIN_NAV) {
      expect(ADMIN_NAV_PERMISSION[item.key], `menu ${item.key} sem permissão`).toBeTruthy();
    }
  });

  it("Admin Master enxerga todos os itens do menu", () => {
    const visiveis = ADMIN_NAV.filter((i) => can(["admin"], ADMIN_NAV_PERMISSION[i.key]));
    expect(visiveis).toHaveLength(ADMIN_NAV.length);
  });

  it("vendedor não acessa financeiro, funcionários, configurações nem parâmetros", () => {
    for (const perm of [
      "finance:view",
      "employees:view",
      "employees:edit",
      "settings:view",
      "settings:edit",
      "params:edit",
      "inventory:edit",
      "queue:manage",
    ] as Permission[]) {
      expect(can(["vendedor"], perm), `vendedor não pode ${perm}`).toBe(false);
    }
  });

  it("vendedor mantém o essencial operacional", () => {
    for (const perm of ["orders:view", "orders:edit", "inventory:view", "queue:view"] as Permission[]) {
      expect(can(["vendedor"], perm), `vendedor precisa de ${perm}`).toBe(true);
    }
  });

  it("nenhuma permissão de vendedor está fora do conjunto do admin", () => {
    const admin = new Set(ROLE_PERMISSIONS.admin);
    for (const perm of ROLE_PERMISSIONS.vendedor) {
      expect(admin.has(perm), `permissão órfã: ${perm}`).toBe(true);
    }
  });

  it("usuário sem papel não vê nenhum item do menu", () => {
    const visiveis = ADMIN_NAV.filter((i) => can([], ADMIN_NAV_PERMISSION[i.key]));
    expect(visiveis).toHaveLength(0);
  });
});
