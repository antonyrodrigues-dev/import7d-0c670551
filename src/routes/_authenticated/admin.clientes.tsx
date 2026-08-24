import { createFileRoute } from "@tanstack/react-router";
import { memo, useState } from "react";
import { formatBRL } from "@/features/catalog";
import { PageHeader, EmptyState } from "@/features/admin/components/PageHeader";
import { PermissionGate } from "@/features/admin/components/PermissionGate";
import { useCustomers, useCustomerHistory } from "@/features/admin/hooks/data/useCustomers";
import type { AdminCustomer } from "@/features/admin/types";
import { formatPhoneBR, capitalizeName } from "@/lib/masks";

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  head: () => ({
    meta: [{ title: "Clientes — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  // A base é agregada no servidor a partir do ledger: busca, paginação e
  // valor gasto não são recalculados no navegador.
  const { customers, query, setQuery, page, setPage, totalPages, total, state } = useCustomers();
  const [detailId, setDetailId] = useState<string | null>(null);
  const detalhe = detailId ? (customers.find((c) => c.id === detailId) ?? null) : null;

  return (
    <PermissionGate perm="customers:view" title="Clientes">
      <PageHeader
        eyebrow="Painel"
        title="Clientes"
        description="Base consolidada no servidor: telefone normalizado e valor gasto apurado pelo financeiro."
      />
      <section aria-label="Controles" className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar por nome, telefone ou cidade"
          className="h-11 flex-1 min-w-[220px] border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm"
          aria-label="Pesquisar clientes"
        />
        <p
          aria-live="polite"
          className="flex h-11 items-center text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]"
        >
          {state === "loading" ? "Carregando…" : `${total} cliente(s)`}
        </p>
      </section>

      {customers.length === 0 ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          description="Assim que houver pedidos, a base será populada aqui."
        />
      ) : (
        <div className="overflow-x-auto border border-[color:var(--border)]">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[color:var(--cream-deep)]/60 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Telefone</th>
                <th className="px-4 py-3 text-left">Cidade</th>
                <th className="px-4 py-3 text-right">Pedidos</th>
                <th className="px-4 py-3 text-left">Última compra</th>
                <th className="px-4 py-3 text-right">Valor gasto</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <CustomerRow key={c.id} customer={c} onOpen={setDetailId} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-end gap-3">
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

      {detalhe && <CustomerDetail customer={detalhe} onClose={() => setDetailId(null)} />}
    </PermissionGate>
  );
}

interface CustomerRowProps {
  customer: AdminCustomer;
  onOpen: (id: string) => void;
}

const CustomerRow = memo(function CustomerRow({ customer: c, onOpen }: CustomerRowProps) {
  return (
    <tr className="border-t border-[color:var(--border)]">
      <td className="px-4 py-3 font-display text-base">{capitalizeName(c.nome)}</td>
      <td className="px-4 py-3 tabular-nums">{formatPhoneBR(c.telefone) || "—"}</td>
      <td className="px-4 py-3">{c.cidade}</td>
      <td className="px-4 py-3 text-right tabular-nums">{c.pedidos}</td>
      <td className="px-4 py-3">
        {c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString("pt-BR") : "—"}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{formatBRL(c.valorGasto)}</td>
      <td className="px-4 py-3 text-[10px] tracking-luxe uppercase">{c.status}</td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => onOpen(c.id)}
          className="h-9 border border-[color:var(--forest-deep)] px-3 text-[10px] tracking-luxe uppercase text-[color:var(--forest-deep)] transition-colors hover:bg-[color:var(--forest-deep)] hover:text-[color:var(--cream)]"
        >
          Ver detalhes
        </button>
      </td>
    </tr>
  );
});

function CustomerDetail({ customer, onClose }: { customer: AdminCustomer; onClose: () => void }) {
  // Histórico carregado sob demanda — a listagem não paga esse custo.
  const { orders, loading } = useCustomerHistory(customer.telefone);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes de ${customer.nome}`}
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-lg overflow-y-auto bg-[color:var(--cream)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] pb-4">
          <div className="min-w-0">
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">Cliente</p>
            <h2 className="font-display text-3xl text-[color:var(--forest-deep)]">
              {capitalizeName(customer.nome)}
            </h2>
            <p className="mt-1 text-[11px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              {formatPhoneBR(customer.telefone) || "—"} · {customer.cidade}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar detalhes"
            className="h-9 w-9 border border-[color:var(--border)] text-[color:var(--forest-deep)]"
          >
            ×
          </button>
        </header>

        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              Pedidos
            </dt>
            <dd className="font-display text-xl tabular-nums">{customer.pedidos}</dd>
          </div>
          <div>
            <dt className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              Valor gasto
            </dt>
            <dd className="font-display text-xl tabular-nums">{formatBRL(customer.valorGasto)}</dd>
          </div>
          <div>
            <dt className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              Última compra
            </dt>
            <dd className="font-display text-xl">
              {customer.ultimaCompra
                ? new Date(customer.ultimaCompra).toLocaleDateString("pt-BR")
                : "—"}
            </dd>
          </div>
        </dl>

        <section aria-label="Histórico de pedidos" className="mt-6">
          <h3 className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Histórico {loading ? "· carregando…" : `(${orders.length})`}
          </h3>
          <ol className="mt-3 flex flex-col gap-3">
            {orders.map((o) => (
              <li
                key={o.id}
                className="border-l-2 border-[color:var(--gold)]/60 bg-[color:var(--cream-deep)]/30 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg tabular-nums text-[color:var(--forest-deep)]">
                    {o.numero}
                  </span>
                  <span className="tabular-nums">{formatBRL(o.valorTotal)}</span>
                </div>
                <p className="mt-1 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                  {new Date(o.criadoEm).toLocaleString("pt-BR")} · {o.status.replace(/_/g, " ")}
                </p>
              </li>
            ))}
            {!loading && orders.length === 0 && (
              <li className="text-sm text-[color:var(--muted-foreground)]">
                Sem pedidos registrados.
              </li>
            )}
          </ol>
        </section>
      </aside>
    </div>
  );
}
