import { createFileRoute } from "@tanstack/react-router";
import { memo, useMemo, useState } from "react";
import { Check, XCircle } from "lucide-react";
import { formatBRL } from "@/features/catalog";
import {
  PageHeader,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/features/admin/components/PageHeader";
import { Button } from "@/components/ui/button";
import { OrderFinancePanel } from "@/features/admin/components/OrderFinancePanel";
import { ORDER_STATUSES } from "@/features/admin/constants";
import { useOrders, usePermissions } from "@/features/admin/hooks";
import { nextStatuses } from "@/features/admin/lib/statusMachine";
import { PENDING_STATUSES } from "@/features/admin/lib/orderView";
import type { AdminOrder, DeliveryMethod, OrderStatus } from "@/features/admin/types";
import type { OrdersFilter } from "@/features/admin/stores/orders";

/** Fonte única: `PENDING_STATUSES` de `lib/orderView`. Nunca duplicar aqui. */
const PENDING_ORDER_STATUSES: OrderStatus[] = PENDING_STATUSES;

export const Route = createFileRoute("/_authenticated/admin/pedidos")({
  head: () => ({
    meta: [{ title: "Pedidos — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: PedidosPage,
});

type PeriodFilter = "todos" | "hoje" | "7d" | "30d";
type EntregaFilter = "todos" | DeliveryMethod;

function withinPeriod(iso: string, period: PeriodFilter): boolean {
  if (period === "todos") return true;
  const d = new Date(iso).getTime();
  const now = Date.now();
  if (period === "hoje") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d >= today.getTime();
  }
  const days = period === "7d" ? 7 : 30;
  return d >= now - days * 86_400_000;
}

function PedidosPage() {
  const { orders, state, filter, error, setFilter, refresh, setStatus } = useOrders();
  const { can, displayName, email } = usePermissions();
  const responsavel = (displayName ?? email ?? "").trim() || undefined;

  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("todos");
  const [entrega, setEntrega] = useState<EntregaFilter>("todos");
  const [pagamento, setPagamento] = useState<string>("todos");
  const [valorMin, setValorMin] = useState<string>("");

  const metodosPagamento = useMemo(
    () => Array.from(new Set(orders.map((o) => o.pagamento.metodo))).filter(Boolean),
    [orders],
  );

  const visiveis = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = Number(valorMin) || 0;
    return orders.filter((o) => {
      if (filter === "pendentes") {
        if (!PENDING_ORDER_STATUSES.includes(o.status)) return false;
      } else if (filter !== "todos" && o.status !== filter) return false;
      if (!withinPeriod(o.criadoEm, period)) return false;
      if (entrega !== "todos" && o.entrega !== entrega) return false;
      if (pagamento !== "todos" && o.pagamento.metodo !== pagamento) return false;
      if (min > 0 && o.valorTotal < min) return false;
      if (q) {
        const hay = [o.numero, o.cliente.nome, o.cliente.telefone, o.cliente.cidade ?? ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, filter, period, entrega, pagamento, valorMin, query]);

  return (
    <>
      <PageHeader
        eyebrow="Painel"
        title="Pedidos"
        description="Todos os pedidos da loja em um único fluxo."
      />

      <section aria-label="Pesquisa e filtros" className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <input
          type="search"
          placeholder="Pesquisar por nome, telefone, número ou cidade"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm md:col-span-2"
          aria-label="Pesquisar pedidos"
        />
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
          className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm"
          aria-label="Filtrar por período"
        >
          <option value="todos">Todo o período</option>
          <option value="hoje">Hoje</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
        </select>
        <select
          value={entrega}
          onChange={(e) => setEntrega(e.target.value as EntregaFilter)}
          className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm"
          aria-label="Filtrar por entrega"
        >
          <option value="todos">Entrega e retirada</option>
          <option value="entrega">Entrega</option>
          <option value="retirada">Retirada</option>
        </select>
        <select
          value={pagamento}
          onChange={(e) => setPagamento(e.target.value)}
          className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm"
          aria-label="Filtrar por pagamento"
        >
          <option value="todos">Todos os pagamentos</option>
          {metodosPagamento.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="Valor mínimo (R$)"
          value={valorMin}
          onChange={(e) => setValorMin(e.target.value)}
          className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm tabular-nums"
          aria-label="Valor mínimo"
        />
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Filtro de status">
        {[
          { key: "todos" as const, label: "Todos" },
          { key: "pendentes" as const, label: "Pendentes" },
          ...ORDER_STATUSES,
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key as OrdersFilter)}
            className={`h-10 border px-4 text-[11px] tracking-luxe uppercase transition-colors ${
              filter === s.key
                ? "border-[color:var(--forest-deep)] bg-[color:var(--forest-deep)] text-[color:var(--cream)]"
                : "border-[color:var(--border)] text-[color:var(--forest-deep)] hover:border-[color:var(--forest-deep)]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {state === "error" && (
        <ErrorState message={error ?? "Falha ao carregar."} onRetry={refresh} />
      )}

      {state === "loading" && orders.length === 0 && (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {state === "ready" && visiveis.length === 0 && (
        <EmptyState
          title="Nenhum pedido neste filtro"
          description="Ajuste os filtros ou aguarde novos pedidos."
        />
      )}

      {visiveis.length > 0 && (
        <ul className="flex flex-col gap-4">
          {visiveis.map((p) => (
            <OrderCard
              key={p.id}
              order={p}
              canEdit={can("orders:edit")}
              onStatus={(id, next) => setStatus(id, next, responsavel)}
            />
          ))}
        </ul>
      )}
    </>
  );
}

interface OrderCardProps {
  order: AdminOrder;
  canEdit: boolean;
  onStatus: (id: string, status: OrderStatus) => Promise<void>;
}

/**
 * Ordem canônica de estágios exibidos na Timeline (o pedido pode "pular"
 * estágios — a máquina de estados permite; a UI ainda mostra a régua completa
 * para dar contexto operacional).
 */
const TIMELINE_STAGES: OrderStatus[] = [
  "novo",
  "pagamento_confirmado",
  "separado",
  "aguardando_retirada",
  "enviado",
  "finalizado",
];

function statusLabel(s: OrderStatus): string {
  return ORDER_STATUSES.find((x) => x.key === s)?.label ?? s;
}

const OrderTimeline = memo(function OrderTimeline({ order }: { order: AdminOrder }) {
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
    <ol
      className="mt-4 flex items-center gap-1 overflow-x-auto"
      aria-label="Linha do tempo do pedido"
    >
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
                  ? "text-[color:var(--forest-deep)] font-semibold"
                  : done
                    ? "text-[color:var(--muted-foreground)]"
                    : "text-[color:var(--muted-foreground)]"
              }`}
            >
              {statusLabel(s as OrderStatus)}
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
});

function StatusActions({
  order,
  canEdit,
  onStatus,
}: {
  order: AdminOrder;
  canEdit: boolean;
  onStatus: (id: string, status: OrderStatus) => Promise<void>;
}) {
  const next = nextStatuses(order.status);
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
  const primaries = next.filter((s) => s !== "cancelado");
  const canCancel = next.includes("cancelado");
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {primaries.map((s) => (
        <Button key={s} size="sm" onClick={() => void onStatus(order.id, s)}>
          Avançar para {statusLabel(s)}
        </Button>
      ))}
      {canCancel && (
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 hover:text-red-700"
          onClick={() => {
            if (confirm(`Cancelar o pedido ${order.numero}?`)) void onStatus(order.id, "cancelado");
          }}
        >
          Cancelar pedido
        </Button>
      )}
    </div>
  );
}

const OrderCard = memo(function OrderCard({ order, canEdit, onStatus }: OrderCardProps) {
  const p = order;
  return (
    <li className="border border-[color:var(--border)] bg-[color:var(--cream)] p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <p className="font-display text-2xl tabular-nums text-[color:var(--forest-deep)]">
            {p.numero}
          </p>
          <p className="mt-1 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            {new Date(p.criadoEm).toLocaleString("pt-BR")} · {p.cliente.nome} · {p.cliente.telefone}
            {p.cliente.cidade ? ` · ${p.cliente.cidade}` : ""}
          </p>
          <p className="mt-1 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            {p.entrega === "entrega" ? "Entrega" : "Retirada"} · {p.pagamento.metodo}
            {p.pagamento.parcelas ? ` · ${p.pagamento.parcelas}×` : ""}
            {p.responsavel ? ` · Resp. ${p.responsavel}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl tabular-nums">{formatBRL(p.valorTotal)}</p>
          <p className="mt-2 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Status: <span className="text-[color:var(--forest-deep)]">{statusLabel(p.status)}</span>
          </p>
        </div>
      </div>

      <OrderTimeline order={p} />
      <StatusActions order={p} canEdit={canEdit} onStatus={onStatus} />
      <OrderFinancePanel order={p} />

      <ul className="mt-4 divide-y divide-[color:var(--border)] border-t border-[color:var(--border)]">
        {p.itens.map((it, idx) => (
          <li key={`${p.id}-${idx}`} className="flex items-center justify-between py-3 text-sm">
            <span>
              {it.name}{" "}
              <span className="text-[color:var(--muted-foreground)]">
                · Tam {it.size} · {it.quantity}×
              </span>
            </span>
            <span className="tabular-nums">{formatBRL(it.price * it.quantity)}</span>
          </li>
        ))}
      </ul>

      <details className="mt-4 border-t border-[color:var(--border)] pt-3">
        <summary className="cursor-pointer text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          Histórico ({p.historico.length})
        </summary>
        <ol className="mt-3 space-y-2 pl-2">
          {p.historico.map((h, i) => (
            <li
              key={`${p.id}-h-${i}`}
              className="border-l-2 border-[color:var(--gold)]/60 pl-3 text-[11px] text-[color:var(--forest-deep)]"
            >
              <span className="tracking-luxe uppercase text-[10px] text-[color:var(--muted-foreground)]">
                {new Date(h.at).toLocaleString("pt-BR")}
              </span>
              <p>
                {h.note ?? h.status}
                {h.by ? ` · ${h.by}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
});
