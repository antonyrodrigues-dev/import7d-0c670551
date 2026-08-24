import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { formatBRL } from "@/features/catalog";
import {
  PageHeader,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/features/admin/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ResponsiveDataTable, type DataTableColumn } from "@/features/admin/components/DataTable";
import { StatusBadge } from "@/features/admin/components/StatusBadge";
import { OrderDetailSheet } from "@/features/admin/components/OrderDetailSheet";
import { QueuePanel } from "@/features/admin/components/QueuePanel";
import { useOrders, usePermissions } from "@/features/admin/hooks";
import {
  ORDERS_TABS,
  deliveryLabel,
  formatDateTimeSP,
  itemsSummary,
  netValue,
  paymentLabel,
  paymentTone,
  relativeFrom,
  statusLabel,
  statusTone,
} from "@/features/admin/lib/orderView";
import type { OrdersTabKey } from "@/features/admin/lib/orderView";
import { ORDERS_PAGE_SIZE } from "@/features/admin/stores/orders";
import type { AdminOrder } from "@/features/admin/types";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({
  validateSearch: (search: Record<string, unknown>): { tab?: OrdersTabKey } => {
    const t = search["tab"];
    const valid = ORDERS_TABS.some((x) => x.key === t);
    return valid ? { tab: t as OrdersTabKey } : {};
  },
  head: () => ({
    meta: [{ title: "Pedidos — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: PedidosPage,
});

function PedidosPage() {
  // A lista é filtrada, buscada e paginada NO SERVIDOR: o navegador nunca
  // carrega a base inteira só para esconder linhas.
  const {
    orders,
    state,
    error,
    refresh,
    setStatus,
    cancelWithRefund,
    query,
    setQuery,
    setStatuses,
    page,
    setPage,
    total,
  } = useOrders();
  const { can, displayName, email } = usePermissions();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const responsavel = (displayName ?? email ?? "").trim() || undefined;
  const canEdit = can("orders:edit");
  const canSeeQueue = can("queue:view");

  const tab: OrdersTabKey = search.tab ?? "todos";
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  // Aba = conjunto de status enviado ao servidor. Fonte única: ORDERS_TABS.
  useEffect(() => {
    setStatuses(ORDERS_TABS.find((t) => t.key === tab)?.statuses ?? []);
  }, [tab, setStatuses]);

  const setTab = (next: OrdersTabKey) =>
    void navigate({ search: next === "todos" ? {} : { tab: next }, replace: true });

  const totalPages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const visiveis = orders;

  const columns: DataTableColumn<AdminOrder>[] = [
    {
      key: "numero",
      header: "Nº do pedido",
      width: "6%",
      cell: (o) => <span className="font-display tabular-nums">{o.numero}</span>,
    },
    {
      key: "cliente",
      header: "Cliente",
      width: "15%",
      cell: (o) => (
        <span>
          {o.cliente.nome}
          <span className="block text-[10px] text-[color:var(--muted-foreground)]">
            {o.cliente.telefone}
          </span>
        </span>
      ),
    },
    {
      key: "canal",
      header: "Canal",
      width: "8%",
      cell: (o) => o.canal ?? deliveryLabel(o),
    },
    {
      key: "itens",
      header: "Itens",
      width: "13%",
      cell: (o) => itemsSummary(o),
    },
    {
      key: "valor",
      header: "Valor",
      width: "9%",
      align: "right",
      cell: (o) => <span className="tabular-nums">{formatBRL(netValue(o))}</span>,
    },
    {
      key: "pagamento",
      header: "Pagamento",
      width: "12%",
      noTruncate: true,
      cell: (o) => (
        <StatusBadge tone={paymentTone(o.pagamentoEstado)}>
          {paymentLabel(o.pagamentoEstado)}
        </StatusBadge>
      ),
    },
    {
      key: "responsavel",
      header: "Responsável",
      width: "9%",
      cell: (o) => o.responsavel ?? "—",
    },
    {
      key: "status",
      header: "Status",
      width: "12%",
      noTruncate: true,
      cell: (o) => <StatusBadge tone={statusTone(o.status)}>{statusLabel(o.status)}</StatusBadge>,
    },
    {
      key: "tempo",
      header: "Criado",
      width: "7%",
      cell: (o) => (
        <span title={formatDateTimeSP(o.criadoEm)} className="text-[color:var(--muted-foreground)]">
          {relativeFrom(o.criadoEm)}
        </span>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      width: "9%",
      align: "right",
      noTruncate: true,
      cell: (o) => (
        <Button size="sm" variant="outline" onClick={() => setSelected(o)}>
          <Eye className="mr-1 h-3.5 w-3.5" /> Ver
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Painel"
        title="Pedidos"
        description="Todos os pedidos da loja em um único fluxo."
      />

      <section aria-label="Pesquisa e filtros" className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <input
          type="search"
          placeholder="Pesquisar por nº, nome, telefone ou cidade"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm md:col-span-2"
          aria-label="Pesquisar pedidos"
        />
        <p
          aria-live="polite"
          className="flex h-11 items-center text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)] md:col-span-2"
        >
          {state === "loading" ? "Carregando…" : `${total} pedido(s) neste filtro`}
        </p>
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Filtro de status">
        {ORDERS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`h-10 border px-4 text-[11px] tracking-luxe uppercase transition-colors ${
              tab === t.key
                ? "border-[color:var(--forest-deep)] bg-[color:var(--forest-deep)] text-[color:var(--cream)]"
                : "border-[color:var(--border)] text-[color:var(--forest-deep)] hover:border-[color:var(--forest-deep)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "atendimento" && canSeeQueue && (
        <section aria-label="Fila de atendimento" className="flex flex-col gap-6">
          <QueuePanel />
        </section>
      )}

      {state === "error" && (
        <ErrorState message={error ?? "Falha ao carregar."} onRetry={refresh} />
      )}

      {state === "loading" && orders.length === 0 && (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
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
        <ResponsiveDataTable
          ariaLabel="Lista de pedidos"
          columns={columns}
          rows={visiveis}
          keyFor={(o) => o.id}
          onRowClick={(o) => setSelected(o)}
          renderCard={(o) => <OrderCard order={o} onOpen={() => setSelected(o)} />}
        />
      )}

      {totalPages > 1 && (
        <nav aria-label="Paginação de pedidos" className="flex items-center justify-end gap-3">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="h-10 border border-[color:var(--border)] px-4 text-[11px] tracking-luxe uppercase disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="h-10 border border-[color:var(--border)] px-4 text-[11px] tracking-luxe uppercase disabled:opacity-40"
          >
            Próxima
          </button>
        </nav>
      )}

      <OrderDetailSheet
        order={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        canEdit={canEdit}
        onStatus={(id, next) => setStatus(id, next, responsavel)}
        onCancelWithRefund={(id, motivo) => cancelWithRefund(id, motivo)}
      />
    </>
  );
}

function OrderCard({ order: o, onOpen }: { order: AdminOrder; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full border border-[color:var(--border)] bg-[color:var(--cream)] p-4 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl tabular-nums text-[color:var(--forest-deep)]">
            {o.numero}
          </p>
          <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">
            {o.cliente.nome} · {o.cliente.telefone}
          </p>
        </div>
        <p className="shrink-0 font-display text-lg tabular-nums text-[color:var(--forest-deep)]">
          {formatBRL(netValue(o))}
        </p>
      </div>
      <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)]">{itemsSummary(o)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge tone={statusTone(o.status)}>{statusLabel(o.status)}</StatusBadge>
        <StatusBadge tone={paymentTone(o.pagamentoEstado)}>
          {paymentLabel(o.pagamentoEstado)}
        </StatusBadge>
      </div>
      <p className="mt-2 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
        {relativeFrom(o.criadoEm)}
        {o.responsavel ? ` · Resp. ${o.responsavel}` : ""}
      </p>
    </button>
  );
}
