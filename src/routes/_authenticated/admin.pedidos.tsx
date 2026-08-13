import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { useOrders, usePermissions } from "@/features/admin/hooks";
import {
  ORDERS_TABS,
  countByTab,
  deliveryLabel,
  formatDateTimeSP,
  itemsSummary,
  matchesTab,
  netValue,
  paymentLabel,
  paymentTone,
  relativeFrom,
  statusLabel,
  statusTone,
} from "@/features/admin/lib/orderView";
import type { OrdersTabKey } from "@/features/admin/lib/orderView";
import type { AdminOrder } from "@/features/admin/types";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({
  head: () => ({
    meta: [{ title: "Pedidos — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: PedidosPage,
});

type PeriodFilter = "todos" | "hoje" | "7d" | "30d";

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
  const { orders, state, error, refresh, setStatus } = useOrders();
  const { can, displayName, email } = usePermissions();
  const responsavel = (displayName ?? email ?? "").trim() || undefined;
  const canEdit = can("orders:edit");

  const [tab, setTab] = useState<OrdersTabKey>("todos");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("todos");
  const [responsavelFiltro, setResponsavelFiltro] = useState<string>("todos");
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  const responsaveis = useMemo(
    () =>
      Array.from(new Set(orders.map((o) => o.responsavel).filter((r): r is string => Boolean(r)))),
    [orders],
  );

  const tabCounts = useMemo(() => countByTab(orders), [orders]);

  const visiveis = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (!matchesTab(o, tab)) return false;
      if (!withinPeriod(o.criadoEm, period)) return false;
      if (responsavelFiltro !== "todos" && o.responsavel !== responsavelFiltro) return false;
      if (q) {
        const hay = [o.numero, o.cliente.nome, o.cliente.telefone, o.cliente.cidade ?? ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, tab, period, responsavelFiltro, query]);

  const columns: DataTableColumn<AdminOrder>[] = [
    {
      key: "numero",
      header: "Nº do pedido",
      width: "9%",
      cell: (o) => <span className="font-display tabular-nums">{o.numero}</span>,
    },
    {
      key: "cliente",
      header: "Cliente",
      width: "17%",
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
      width: "15%",
      cell: (o) => itemsSummary(o),
    },
    {
      key: "valor",
      header: "Valor",
      width: "10%",
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
      width: "8%",
      cell: (o) => (
        <span title={formatDateTimeSP(o.criadoEm)} className="text-[color:var(--muted-foreground)]">
          {relativeFrom(o.criadoEm)}
        </span>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      width: "1%",
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
          value={responsavelFiltro}
          onChange={(e) => setResponsavelFiltro(e.target.value)}
          className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm"
          aria-label="Filtrar por responsável"
        >
          <option value="todos">Todos os responsáveis</option>
          {responsaveis.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
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
            {t.label} · {tabCounts[t.key]}
          </button>
        ))}
      </nav>

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

      <OrderDetailSheet
        order={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        canEdit={canEdit}
        onStatus={(id, next) => setStatus(id, next, responsavel)}
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
