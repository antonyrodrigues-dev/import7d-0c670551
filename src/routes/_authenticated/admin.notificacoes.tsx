import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { EmptyState } from "@/features/admin/components/AdminUI";
import { PermissionGate } from "@/features/admin/components/PermissionGate";
import { BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminNotifications } from "@/features/admin/hooks";

export const Route = createFileRoute("/_authenticated/admin/notificacoes")({
  head: () => ({
    meta: [{ title: "Notificações — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: NotificacoesPage,
});

function NotificacoesPage() {
  const { notifications, markAllRead, markRead, clear } = useAdminNotifications();

  return (
    <PermissionGate perm="notifications:view" title="Notificações">
      <PageHeader
        eyebrow="Painel"
        title="Notificações"
        description="Alertas operacionais do painel administrativo."
        actions={
          notifications.length > 0 ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={markAllRead}>
                Marcar tudo como lido
              </Button>
              <Button variant="outline" size="sm" onClick={clear}>
                Limpar
              </Button>
            </div>
          ) : null
        }
      />
      {notifications.length === 0 ? (
        <EmptyState
          icon={<BellOff className="h-5 w-5" />}
          title="Sem notificações"
          description="Novos alertas do painel aparecem aqui automaticamente."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`flex items-start justify-between gap-4 border p-4 ${
                n.read
                  ? "border-[color:var(--border)] bg-[color:var(--cream)]"
                  : "border-[color:var(--gold)] bg-[color:var(--cream)]"
              }`}
            >
              <div className="min-w-0">
                <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">
                  {n.kind}
                </p>
                <p className="mt-1 font-display text-lg text-[color:var(--forest-deep)]">
                  {n.title}
                </p>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{n.body}</p>
                <p className="mt-2 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                  {new Date(n.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
              {!n.read && (
                <button
                  onClick={() => markRead(n.id)}
                  className="shrink-0 text-[10px] tracking-luxe uppercase text-[color:var(--forest-deep)] hover:underline"
                >
                  Marcar lida
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </PermissionGate>
  );
}
