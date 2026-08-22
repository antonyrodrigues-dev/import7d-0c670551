import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Rota histórica de Atendimentos. A fila agora vive na central de Pedidos
 * (aba "Atendimento"), fonte única do fluxo operacional.
 */
export const Route = createFileRoute("/_authenticated/admin/atendimentos")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/pedidos", search: { tab: "atendimento" } });
  },
});
