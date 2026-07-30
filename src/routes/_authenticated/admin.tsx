import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/features/admin/layout/AdminShell";

/**
 * Layout do painel administrativo. Rotas filhas (`admin.index`,
 * `admin.pedidos`, etc.) renderizam via `<Outlet />` dentro do shell.
 */
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Painel — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminShell,
});
