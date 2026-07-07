import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/features/admin/components/PageHeader";
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
    <>
      <PageHeader
        eyebrow="Painel"
        title="Notificações"
        description="Sistema interno. Integrações realtime (WhatsApp, Telegram) chegam nos próximos sprints."
        actions={
          <div className="flex gap-2">
            <button
              onClick={markAllRead}
              className="h-10 border border-[color:var(--border)] px-4 text-[11px] tracking-luxe uppercase transition-colors hover:border-[color:var(--forest-deep)]"
            >
              Marcar tudo como lido
            </button>
            <button
              onClick={clear}
              className="h-10 border border-[color:var(--border)] px-4 text-[11px] tracking-luxe uppercase transition-colors hover:border-[color:var(--destructive)]"
            >
              Limpar
            </button>
          </div>
        }
      />
      {notifications.length === 0 ? (
        <EmptyState title="Sem notificações" description="Você está em dia." />
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
                <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">{n.kind}</p>
                <p className="mt-1 font-display text-lg text-[color:var(--forest-deep)]">{n.title}</p>
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
    </>
  );
}