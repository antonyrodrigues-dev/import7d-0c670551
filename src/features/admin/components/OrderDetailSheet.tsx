/**
 * 7D IMPORTS — Painel lateral de detalhe do pedido.
 *
 * Mostra timeline, itens, dados do cliente, financeiro e as ações de status
 * válidas (derivadas de `statusMachine`). Apresentação pura — toda mutação
 * passa pelo `setStatus` já mediado pelo hook `useOrders`.
 */

import { Check, XCircle } from "lucide-react";
import { formatBRL } from "@/features/catalog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { OrderFinancePanel } from "./OrderFinancePanel";
import { StatusBadge } from "./StatusBadge";
import { operationalNextStatuses } from "../lib/statusMachine";
import {
  deliveryLabel,
  formatDateTimeSP,
  paymentLabel,
  paymentTone,
  statusLabel,
  statusTone,
} from "../lib/orderView";
import type { AdminOrder, OrderStatus } from "../types";

const TIMELINE_STAGES: OrderStatus[] = [
  "novo",
  "pagamento_confirmado",
  "separado",
  "aguardando_retirada",
  "enviado",
  "finalizado",
];

export function OrderDetailSheet({
  order,
  open,
  onOpenChange,
  canEdit,
  onStatus,
  onCancelWithRefund,
}: {
  order: AdminOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  onStatus: (id: string, status: OrderStatus) => Promise<void>;
  onCancelWithRefund?: (id: string, motivo?: string) => Promise<void>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-full overflow-y-auto bg-[color:var(--cream)] sm:max-w-xl"
      >
        {order && (
          <>
            <SheetHeader>
              <SheetTitle className="font-display text-2xl text-[color:var(--forest-deep)]">
                Pedido {order.numero}
              </SheetTitle>
              <SheetDescription>
                {formatDateTimeSP(order.criadoEm)} · {deliveryLabel(order)}
                {order.canal ? ` · Canal ${order.canal}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone={statusTone(order.status)}>{statusLabel(order.status)}</StatusBadge>
              <StatusBadge tone={paymentTone(order.pagamentoEstado)}>
                Pagamento: {paymentLabel(order.pagamentoEstado)}
              </StatusBadge>
            </div>

            <OrderTimeline order={order} />
            <StatusActions
              order={order}
              canEdit={canEdit}
              onStatus={onStatus}
              onCancelWithRefund={onCancelWithRefund}
            />

            <section className="mt-6 border-t border-[color:var(--border)] pt-4">
              <h3 className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Cliente
              </h3>
              <p className="mt-2 text-sm text-[color:var(--forest-deep)]">
                {order.cliente.nome} · {order.cliente.telefone}
                {order.cliente.cidade ? ` · ${order.cliente.cidade}` : ""}
              </p>
              {order.enderecoDetalhe?.linha && (
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  {order.enderecoDetalhe.linha}
                </p>
              )}
              {order.responsavel && (
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  Responsável: {order.responsavel}
                </p>
              )}
            </section>

            <section className="mt-6 border-t border-[color:var(--border)] pt-4">
              <h3 className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Itens
              </h3>
              <ul className="mt-2 divide-y divide-[color:var(--border)]">
                {order.itens.map((it, idx) => (
                  <li
                    key={`${order.id}-${idx}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {it.name}{" "}
                      <span className="text-[color:var(--muted-foreground)]">
                        · Tam {it.size} · {it.quantity}×
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatBRL(it.price * it.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-right font-display text-xl tabular-nums text-[color:var(--forest-deep)]">
                {formatBRL(order.valorTotal)}
              </p>
            </section>

            <OrderFinancePanel order={order} />

            <section className="mt-6 border-t border-[color:var(--border)] pt-4">
              <h3 className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Histórico ({order.historico.length})
              </h3>
              <ol className="mt-3 space-y-2 pl-2">
                {order.historico.map((h, i) => (
                  <li
                    key={`${order.id}-h-${i}`}
                    className="border-l-2 border-[color:var(--gold)]/60 pl-3 text-[11px] text-[color:var(--forest-deep)]"
                  >
                    <span className="tracking-luxe uppercase text-[10px] text-[color:var(--muted-foreground)]">
                      {formatDateTimeSP(h.at)}
                    </span>
                    <p>
                      {h.note ?? statusLabel(h.status)}
                      {h.by ? ` · ${h.by}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function OrderTimeline({ order }: { order: AdminOrder }) {
  if (order.status === "cancelado") {
    return (
      <div className="mt-4 flex items-center gap-2 border border-red-300 bg-red-50 px-3 py-2 text-[11px] tracking-luxe uppercase text-red-700">
        <XCircle className="h-4 w-4" /> Pedido cancelado
      </div>
    );
  }
  const stages =
    order.status === "reservado"
      ? ["novo", "pagamento_confirmado", "reservado", ...TIMELINE_STAGES.slice(3)]
      : TIMELINE_STAGES;
  const currentIdx = Math.max(0, stages.indexOf(order.status));
  return (
    <ol className="mt-4 flex flex-wrap items-center gap-y-2" aria-label="Linha do tempo do pedido">
      {stages.map((s, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        return (
          <li key={s} className="flex items-center gap-1 whitespace-nowrap">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] ${
                done
                  ? "border-[color:var(--forest-deep)] bg-[color:var(--forest-deep)] text-[color:var(--cream)]"
                  : current
                    ? "border-[color:var(--gold)] bg-[color:var(--gold)] text-white"
                    : "border-[color:var(--border)] bg-white text-[color:var(--muted-foreground)]"
              }`}
              aria-current={current ? "step" : undefined}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span
              className={`text-[10px] tracking-luxe uppercase ${
                current
                  ? "font-semibold text-[color:var(--forest-deep)]"
                  : "text-[color:var(--muted-foreground)]"
              }`}
            >
              {statusLabel(s)}
            </span>
            {i < stages.length - 1 && (
              <div
                className={`mx-1 h-px w-6 ${
                  done ? "bg-[color:var(--forest-deep)]" : "bg-[color:var(--border)]"
                }`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StatusActions({
  order,
  canEdit,
  onStatus,
  onCancelWithRefund,
}: {
  order: AdminOrder;
  canEdit: boolean;
  onStatus: (id: string, status: OrderStatus) => Promise<void>;
  onCancelWithRefund?: (id: string, motivo?: string) => Promise<void>;
}) {
  const next = operationalNextStatuses(order.status);
  const pago = order.pagamentoEstado === "confirmado";
  if (!canEdit) {
    return (
      <p className="mt-3 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
        Somente Administrador Master ou Vendedor pode alterar o status.
      </p>
    );
  }
  if (next.length === 0) {
    return (
      <p className="mt-3 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
        Este pedido não possui próximas etapas.
      </p>
    );
  }
  const primaries = next.filter((s: OrderStatus) => s !== "cancelado");
  const canCancel = next.includes("cancelado");
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {primaries.map((s: OrderStatus) => (
          <Button key={s} size="sm" onClick={() => void onStatus(order.id, s)}>
            Avançar para {statusLabel(s)}
          </Button>
        ))}
        {canCancel && !pago && (
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={() => {
              if (confirm(`Cancelar o pedido ${order.numero}?`))
                void onStatus(order.id, "cancelado");
            }}
          >
            Cancelar pedido
          </Button>
        )}
        {canCancel && pago && onCancelWithRefund && (
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={() => {
              if (
                confirm(
                  `Cancelar o pedido ${order.numero} e estornar ${formatBRL(order.valorTotal)}?`,
                )
              ) {
                void onCancelWithRefund(order.id, "Cancelamento administrativo");
              }
            }}
          >
            Cancelar com estorno
          </Button>
        )}
      </div>
      {order.status === "aguardando_pagamento" && (
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          Confirmação de pagamento só pelo painel financeiro deste pedido.
        </p>
      )}
    </div>
  );
}
