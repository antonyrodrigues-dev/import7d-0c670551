import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useRemoteNotifications } from "../hooks";
import type { RemoteNotificationSeverity } from "../types";

const DOT: Record<RemoteNotificationSeverity, string> = {
  info: "bg-[color:var(--muted-foreground)]",
  sucesso: "bg-emerald-500",
  alerta: "bg-amber-500",
  critico: "bg-red-500",
};

/**
 * Sino de notificações do painel — badge ao vivo (Realtime) e prévia das
 * últimas ocorrências. Toda leitura/escrita passa pelo hook, que orquestra
 * service → store → adapter. Nenhum acesso direto ao banco aqui.
 */
export function NotificationBell() {
  const { items, naoLidas, marcarLida, marcarTodasLidas } = useRemoteNotifications();
  const [open, setOpen] = useState(false);
  const preview = items.slice(0, 6);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notificações (${naoLidas} não lidas)`}
          className="relative flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-[color:var(--cream-deep)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {naoLidas > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--gold)] px-1 text-[9px] font-bold text-[color:var(--forest-deep)]">
              {naoLidas > 99 ? "99+" : naoLidas}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-[color:var(--border)] px-4 py-3">
          <p className="text-[11px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Notificações
          </p>
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => void marcarTodasLidas()}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Marcar todas
            </Button>
          )}
        </div>

        {preview.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <BellOff className="h-5 w-5 text-[color:var(--muted-foreground)]" aria-hidden="true" />
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Nenhuma notificação por enquanto.
            </p>
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {preview.map((n) => (
              <li key={n.id} className="border-b border-[color:var(--border)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    if (!n.lido) void marcarLida(n.id);
                  }}
                  className={`flex w-full items-start gap-2 px-4 py-3 text-left transition-colors hover:bg-[color:var(--cream-deep)]/50 ${
                    n.lido ? "opacity-60" : ""
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[n.severidade]}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[color:var(--forest-deep)]">
                      {n.titulo}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-xs text-[color:var(--muted-foreground)]">
                      {n.mensagem}
                    </span>
                    <span className="mt-1 block text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                      {new Date(n.criadoEm).toLocaleString("pt-BR")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-[color:var(--border)] px-4 py-2">
          <Link
            to="/admin/notificacoes"
            onClick={() => setOpen(false)}
            className="text-xs font-semibold text-[color:var(--forest-deep)] underline-offset-4 hover:underline"
          >
            Ver todas as notificações
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}