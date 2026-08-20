import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Portaria única do painel.
 *
 * Não basta existir sessão: o acesso exige perfil ATIVO e ao menos um cargo
 * atribuído. Quem foi inativado ou ainda aguarda liberação é devolvido para
 * `/auth` com o motivo, mesmo com sessão válida no navegador.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const userId = data.user.id;
    const [{ data: perfil }, { data: cargos }] = await Promise.all([
      supabase.from("profiles").select("status").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (!perfil || perfil.status !== "ativo") {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { motivo: "inativo" } });
    }
    if (!cargos || cargos.length === 0) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { motivo: "sem_cargo" } });
    }

    // Último acesso: carimbo de presença do operador (não bloqueia a entrada).
    void supabase
      .from("profiles")
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq("user_id", userId);

    return { user: data.user, roles: cargos.map((c) => c.role) };
  },
  component: () => <Outlet />,
});
