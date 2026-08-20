/**
 * 7D IMPORTS — Trilha de auditoria do pedido.
 *
 * Espelha `pedido_eventos`, a tabela imutável mantida pelo banco. Nenhuma
 * ação aqui: é registro histórico e serve para explicar "o que aconteceu".
 */

import { useState } from "react";
import { formatDateTimeSP } from "../lib/orderView";
import { useOrderAudit } from "../hooks/data/useOrderAudit";

const EVENT_LABELS: Record<string, string> = {
  criado: "Pedido criado",
  status: "Status alterado",
  status_alterado: "Status alterado",
  pagamento: "Pagamento registrado",
  pagamento_registrado: "Pagamento registrado",
  estorno: "Estorno lançado",
  devolucao: "Devolução registrada",
  frete: "Frete definido",
  frete_definido: "Frete definido",
  whatsapp: "Contato por WhatsApp",
  atendimento: "Atendimento",
  cancelado: "Pedido cancelado",
  reserva: "Reserva de estoque",
};

function eventLabel(tipo: string): string {
  return EVENT_LABELS[tipo] ?? tipo.replace(/_/g, " ");
}

function describe(detalhe: Record<string, unknown>): string {
  const parts = Object.entries(detalhe)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .slice(0, 4)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`);
  return parts.join(" · ");
}

export function OrderAuditTrail({ orderId, open }: { orderId: string; open: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { events, state, error } = useOrderAudit(orderId, open);
  const visible = expanded ? events : events.slice(0, 5);

  return (
    <section className="mt-6 border-t border-[color:var(--border)] pt-4">
      <h3 className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
        Trilha de auditoria {events.length > 0 ? `(${events.length})` : ""}
      </h3>

      {state === "loading" && (
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">Carregando registros…</p>
      )}
      {state === "error" && (
        <p className="mt-2 text-sm text-red-600">
          Não foi possível carregar a auditoria. {error}
        </p>
      )}
      {state === "success" && events.length === 0 && (
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
          Nenhum evento registrado até agora.
        </p>
      )}

      <ol className="mt-2 divide-y divide-[color:var(--border)]">
        {visible.map((ev) => {
          const resumo = describe(ev.detalhe);
          return (
            <li key={ev.id} className="py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm text-[color:var(--forest-deep)]">
                  {eventLabel(ev.tipo)}
                </span>
                <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                  {formatDateTimeSP(ev.criadoEm)} · {ev.origem}
                </span>
              </div>
              {resumo && (
                <p className="mt-1 break-words text-xs text-[color:var(--muted-foreground)]">
                  {resumo}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {events.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-[10px] tracking-luxe uppercase text-[color:var(--forest-deep)] underline"
        >
          {expanded ? "Mostrar menos" : `Ver todos os ${events.length} eventos`}
        </button>
      )}
    </section>
  );
}
