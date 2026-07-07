import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { formatBRL } from "@/data/products";
import { PageHeader, EmptyState } from "@/features/admin/components/PageHeader";
import { useOrders, useCustomers } from "@/features/admin/hooks";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  head: () => ({
    meta: [{ title: "Clientes — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  useOrders();
  const { customers, query, sortBy, setQuery, setSortBy } = useCustomers();
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? customers.filter(
          (c) => c.nome.toLowerCase().includes(q) || c.telefone.includes(q),
        )
      : customers;
    const sorted = [...base].sort((a, b) => {
      if (sortBy === "valor") return b.valorGasto - a.valorGasto;
      if (sortBy === "nome") return a.nome.localeCompare(b.nome);
      return (b.ultimaCompra ?? "").localeCompare(a.ultimaCompra ?? "");
    });
    return sorted;
  }, [customers, query, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visiveis = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader eyebrow="Painel" title="Clientes" description="Base derivada dos pedidos recebidos." />
      <section aria-label="Controles" className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Pesquisar por nome ou telefone"
          className="h-11 flex-1 min-w-[220px] border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm"
          aria-label="Pesquisar clientes"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm"
          aria-label="Ordenar"
        >
          <option value="valor">Ordenar por valor</option>
          <option value="recente">Ordenar por última compra</option>
          <option value="nome">Ordenar por nome</option>
        </select>
      </section>

      {visiveis.length === 0 ? (
        <EmptyState title="Nenhum cliente encontrado" description="Assim que houver pedidos, a base será populada aqui." />
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
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => (
                <tr key={c.id} className="border-t border-[color:var(--border)]">
                  <td className="px-4 py-3 font-display text-base">{c.nome}</td>
                  <td className="px-4 py-3 tabular-nums">{c.telefone}</td>
                  <td className="px-4 py-3">{c.cidade}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.pedidos}</td>
                  <td className="px-4 py-3">
                    {c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatBRL(c.valorGasto)}</td>
                  <td className="px-4 py-3 text-[10px] tracking-luxe uppercase">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <nav aria-label="Paginação" className="flex items-center justify-end gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-10 border border-[color:var(--border)] px-4 text-[11px] tracking-luxe uppercase disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="h-10 border border-[color:var(--border)] px-4 text-[11px] tracking-luxe uppercase disabled:opacity-40"
          >
            Próxima
          </button>
        </nav>
      )}
    </>
  );
}