/**
 * 7D IMPORTS — Painel lateral de detalhe do pedido.
 *
 * Mostra timeline, itens, dados do cliente, financeiro e as ações de status
 * válidas (derivadas de `statusMachine`). Apresentação pura — toda mutação
 * passa pelo `setStatus` já mediado pelo hook `useOrders`.
 */

import { useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OrderFinancePanel } from "./OrderFinancePanel";
import { OrderPendenciesPanel } from "./OrderPendenciesPanel";
import { OrderAuditTrail } from "./OrderAuditTrail";
import { StatusBadge } from "./StatusBadge";
import { orderActionPlan, VISUAL_STAGES, visualStageIndex } from "../lib/nextAction";
import {
  deliveryLabel,
  formatDateTimeSP,
  paymentLabel,
  paymentTone,
  statusLabel,
  statusTone,
} from "../lib/orderView";
import type { AdminOrder, OrderStatus } from "../types";

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

            <OrderPendenciesPanel order={order} canEdit={canEdit} />

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

            <OrderAuditTrail orderId={order.id} open={open} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function OrderTimeline({ order }: { order: AdminOrder }) {
  if (order.status === "cancelado" || order.status === "devolvido") {
    return (
      <div className="mt-4 flex items-center gap-2 border border-red-300 bg-red-50 px-3 py-2 text-[11px] tracking-luxe uppercase text-red-700">
        <XCircle className="h-4 w-4" />
        {order.status === "cancelado" ? "Pedido cancelado" : "Pedido devolvido"}
      </div>
    );
  }
  // Timeline enxuta: as 5 etapas que a loja realmente enxerga. Os estados
  // técnicos continuam no banco e na trilha de auditoria.
  const currentIdx = Math.max(0, visualStageIndex(order.status));
  return (
    <ol className="mt-4 flex flex-wrap items-center gap-y-2" aria-label="Linha do tempo do pedido">
      {VISUAL_STAGES.map((stage, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        return (
          <li key={stage.key} className="flex items-center gap-1 whitespace-nowrap">
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
              {stage.label}
            </span>
            {i < VISUAL_STAGES.length - 1 && (
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

/**
 * UMA ação primária por estado — nunca uma lista de status crus. O plano vem
 * de `orderActionPlan` (fonte única), que só oferece o que o banco aceita e
 * esconde ações financeiras enquanto houver pendência de preço ou tamanho.
 */
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
  const [confirmCancel, setConfirmCancel] = useState(false);
  const plan = orderActionPlan(order);
  const pago = order.pagamentoEstado === "confirmado";

  if (!canEdit) {
    return (
      <p className="mt-3 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
        Somente Administrador Master ou Vendedor pode alterar o status.
      </p>
    );
  }

  const primary = plan.primary;
  const secondary = plan.secondary;

  return (
    <div className="mt-3 space-y-2">
      {plan.pendencies.length > 0 && (
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">
          Pendências: {plan.pendencies.join(" · ")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {primary?.kind === "status" && primary.status && (
          <Button size="sm" onClick={() => void onStatus(order.id, primary.status as OrderStatus)}>
            {primary.label}
          </Button>
        )}
        {(secondary?.kind === "cancel" || secondary?.kind === "refund") && (
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={() => setConfirmCancel(true)}
            disabled={secondary.kind === "refund" && !onCancelWithRefund}
          >
            {secondary.label}
          </Button>
        )}
      </div>

      {primary?.hint && (
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          {primary.hint}
        </p>
      )}
      {primary?.kind === "pendency" && (
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          Confirme tamanho e preço no bloco de pendências deste pedido.
        </p>
      )}
      {primary?.kind === "payment" && (
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          Confirmação de pagamento só pelo painel financeiro deste pedido.
        </p>
      )}
      {!primary && !secondary && (
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          Este pedido não possui próximas etapas.
        </p>
      )}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar o pedido {order.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pago
                ? `O pagamento confirmado de ${formatBRL(order.valorTotal)} será estornado no extrato e o estoque devolvido, tudo na mesma operação.`
                : "As reservas de estoque deste pedido serão liberadas. A ação fica registrada na trilha de auditoria."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter pedido</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmCancel(false);
                if (pago && onCancelWithRefund) {
                  void onCancelWithRefund(order.id, "Cancelamento administrativo");
                } else if (!pago) {
                  void onStatus(order.id, "cancelado");
                }
              }}
            >
              {pago ? "Cancelar e estornar" : "Cancelar pedido"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
