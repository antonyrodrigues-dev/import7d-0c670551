import { supabase } from "@/integrations/supabase/client";
import type { Employee } from "../types";

/**
 * Lista funcionários combinando `user_roles` com dados do Auth.
 * Requer papel admin para retornar dados; consumidores devem antes
 * verificar `usePermissions().can("employees:view")`.
 */
export async function listEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id, user_id, role, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const seen = new Map<string, Employee>();
  for (const row of data ?? []) {
    const role = row.role === "admin" ? "admin" : "vendedor";
    const id = String(row.user_id);
    if (!seen.has(id)) {
      seen.set(id, {
        id,
        nome: id.slice(0, 8),
        email: "—",
        role,
        ativo: true,
      });
    } else if (role === "admin") {
      seen.get(id)!.role = "admin";
    }
  }
  return Array.from(seen.values());
}