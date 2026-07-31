import { createFileRoute } from "@tanstack/react-router";
import { BellOff, CheckCheck, RefreshCw } from "lucide-react";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/features/admin/components/AdminUI";
import { PermissionGate } from "@/features/admin/components/PermissionGate";
import { Button } from "@/components/ui/button";
import { useRemoteNotifications } from "@/features/admin/hooks";
import type { RemoteNotificationSeverity } from "@/features/admin/types";

export const Route = createFileRoute("/_authenticated/admin/notificacoes")({
  head: () => ({
    meta: [{ title: "Notificações — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: NotificacoesPage,
});

const TONE: Record<RemoteNotificationSeverity, string> = {
  info: "border-[color:var(--border)] bg-[color:var(--cream-deep)]/40 text-[color:var(--muted-foreground)]",
  sucesso: "border-emerald-300 bg-emerald-50 text-emerald-800",
  alerta: "border-amber-300 bg-amber-50 text-amber-800",
  critico: "border-red-300 bg-red-50 text-red-700",
};

function NotificacoesPage() {
  return (
    <PermissionGate perm="notifications:view" title="Notificações">
      <NotificacoesView />
    </PermissionGate>
  );
}

function NotificacoesView() {
  const { state, items, naoLidas, refresh, marcarLida, marcarTodasLidas } = useRemoteNotifications();

  return (
    <>
      <PageHeader
        eyebrow="Painel"
        title="Notificações"
        description="Eventos operacionais persistentes, sincronizados em tempo real entre todos os dispositivos."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Atualizar
            </Button>
            {naoLidas > 0 && (
              <Button size="sm" onClick={() => void marcarTodasLidas()}>
                <CheckCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                Marcar todas como lidas ({naoLidas})
              </Button>
            )}
          </div>
        }
      />

      {state === "error" && (
        <ErrorState message="Não foi possível carregar as notificações." onRetry={() => void refresh()} />
      )}
      {state === "loading" && items.length === 0 && <LoadingState label="Carregando notificações…" />}
      {state !== "loading" && state !== "error" && items.length === 0 && (
        <EmptyState
          icon={<BellOff className="h-5 w-5" />}
          title="Nenhuma notificação"
          description="Novos eventos de pedidos, pagamentos, reservas e devoluções aparecem aqui automaticamente."
        />
      )}

      {items.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`border p-4 ${n.lido ? "opacity-70" : ""} ${TONE[n.severidade]}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg text-[color:var(--forest-deep)]">{n.titulo}</p>
                  <p className="mt-1 text-sm text-[color:var(--forest-deep)]">{n.mensagem}</p>
                  <p className="mt-2 text-[10px] tracking-luxe uppercase">
                    {new Date(n.criadoEm).toLocaleString("pt-BR")} · {n.tipo}
                    {n.entidade ? ` · ${n.entidade}` : ""}
                  </p>
                </div>
                {!n.lido && (
                  <Button variant="outline" size="sm" onClick={() => void marcarLida(n.id)}>
                    Marcar como lida
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
