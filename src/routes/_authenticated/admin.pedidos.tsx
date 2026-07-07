import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { formatBRL } from "@/data/products";
import { PageHeader, EmptyState, ErrorState, Skeleton } from "@/features/admin/components/PageHeader";
import { ORDER_STATUSES } from "@/features/admin/constants";
import { useOrdersStore } from "@/features/admin/stores/orders";
import { usePermissions } from "@/features/admin/hooks/usePermissions";
import type { OrderStatus } from "@/features/admin/types";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({
  head: () => ({
    meta: [{ title: "Pedidos — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: PedidosPage,
});

function PedidosPage() {
  const { orders, state, filter, error, setFilter, refresh, setStatus } = useOrdersStore();
  const { can } = usePermissions();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visiveis = orders.filter((o) => filter === "todos" || o.status === filter);

  return (
    <>
      <PageHeader eyebrow="Painel" title="Pedidos" description="Todos os pedidos da loja em um único fluxo." />

      <nav className="flex flex-wrap gap-2" aria-label="Filtro de status">
        {([{ key: "todos" as const, label: "Todos" }, ...ORDER_STATUSES]).map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key as OrderStatus | "todos")}
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

      {state === "error" && <ErrorState message={error ?? "Falha ao carregar."} onRetry={refresh} />}

      {state === "loading" && orders.length === 0 && (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {state === "ready" && visiveis.length === 0 && (
        <EmptyState title="Nenhum pedido neste filtro" description="Ajuste o filtro ou aguarde novos pedidos." />
      )}

      {visiveis.length > 0 && (
        <ul className="flex flex-col gap-4">
          {visiveis.map((p) => (
            <li key={p.id} className="border border-[color:var(--border)] bg-[color:var(--cream)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-display text-2xl tabular-nums text-[color:var(--forest-deep)]">{p.numero}</p>
                  <p className="mt-1 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                    {new Date(p.criadoEm).toLocaleString("pt-BR")} · {p.cliente.nome} · {p.cliente.telefone}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl tabular-nums">{formatBRL(p.valorTotal)}</p>
                  <select
                    aria-label="Status do pedido"
                    value={p.status}
                    disabled={!can("orders:edit")}
                    onChange={(e) => setStatus(p.id, e.target.value as OrderStatus)}
                    className="mt-2 h-10 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-[11px] tracking-luxe uppercase text-[color:var(--forest-deep)] disabled:opacity-50"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <ul className="mt-4 divide-y divide-[color:var(--border)] border-t border-[color:var(--border)]">
                {p.itens.map((it, idx) => (
                  <li key={`${p.id}-${idx}`} className="flex items-center justify-between py-3 text-sm">
                    <span>
                      {it.name}{" "}
                      <span className="text-[color:var(--muted-foreground)]">· Tam {it.size} · {it.quantity}×</span>
                    </span>
                    <span className="tabular-nums">{formatBRL(it.price * it.quantity)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}