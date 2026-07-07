import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { formatBRL } from "@/data/products";
import { PageHeader, EmptyState, Skeleton } from "@/features/admin/components/PageHeader";
import { LOW_STOCK_THRESHOLD } from "@/features/admin/constants";
import { useInventory } from "@/features/admin/hooks";
import type { InventoryItem } from "@/features/admin/types";

type StockLevel = "sem" | "baixo" | "normal";

function levelOf(i: InventoryItem): StockLevel {
  if (i.quantity <= 0) return "sem";
  if (i.quantity <= LOW_STOCK_THRESHOLD) return "baixo";
  return "normal";
}

const LEVEL_LABEL: Record<StockLevel, string> = {
  sem: "Sem estoque",
  baixo: "Estoque baixo",
  normal: "Estoque normal",
};

const LEVEL_CLASS: Record<StockLevel, string> = {
  sem: "text-[color:var(--destructive)]",
  baixo: "text-[color:var(--gold)]",
  normal: "text-[color:var(--forest-deep)]",
};

export const Route = createFileRoute("/_authenticated/admin/estoque")({
  head: () => ({
    meta: [{ title: "Estoque — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: EstoquePage,
});

function EstoquePage() {
  const {
    items,
    state,
    query,
    filterBrand,
    filterCategory,
    filterStatus,
    setQuery,
    setFilterBrand,
    setFilterCategory,
    setFilterStatus,
  } = useInventory();

  const brands = useMemo(() => Array.from(new Set(items.map((i) => i.brand))), [items]);
  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category))), [items]);

  const visiveis = items.filter((i) => {
    const q = query.trim().toLowerCase();
    if (q && !i.name.toLowerCase().includes(q) && !i.sku.toLowerCase().includes(q)) return false;
    if (filterBrand !== "todas" && i.brand !== filterBrand) return false;
    if (filterCategory !== "todas" && i.category !== filterCategory) return false;
    if (filterStatus === "ativos" && !i.active) return false;
    if (filterStatus === "inativos" && i.active) return false;
    return true;
  });

  return (
    <>
      <PageHeader eyebrow="Painel" title="Estoque" description="Cadastro, quantidade e destaque dos produtos." />

      <section aria-label="Filtros" className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <input
          type="search"
          placeholder="Pesquisar por nome ou SKU"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm text-[color:var(--forest-deep)] focus:border-[color:var(--forest-deep)] focus:outline-none"
          aria-label="Pesquisar estoque"
        />
        <select
          value={filterBrand}
          onChange={(e) => setFilterBrand(e.target.value)}
          className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm text-[color:var(--forest-deep)]"
          aria-label="Filtrar por marca"
        >
          <option value="todas">Todas as marcas</option>
          {brands.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm text-[color:var(--forest-deep)]"
          aria-label="Filtrar por categoria"
        >
          <option value="todas">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "todos" | "ativos" | "inativos")}
          className="h-11 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm text-[color:var(--forest-deep)]"
          aria-label="Filtrar por status"
        >
          <option value="todos">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
        </select>
      </section>

      {state === "loading" && items.length === 0 ? (
        <Skeleton className="h-64 w-full" />
      ) : visiveis.length === 0 ? (
        <EmptyState title="Nenhum produto encontrado" description="Ajuste os filtros ou cadastre novos produtos." />
      ) : (
        <div className="overflow-x-auto border border-[color:var(--border)]">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[color:var(--cream-deep)]/60 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 text-left">Produto</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Marca</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-left">Cor</th>
                <th className="px-4 py-3 text-right">Qtd</th>
                <th className="px-4 py-3 text-right">Preço</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((i) => (
                <tr key={i.id} className="border-t border-[color:var(--border)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={i.image}
                        alt=""
                        width={40}
                        height={52}
                        loading="lazy"
                        className="aspect-[3/4] h-12 w-9 object-cover"
                      />
                      <span className="font-display text-base text-[color:var(--forest-deep)]">{i.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{i.sku}</td>
                  <td className="px-4 py-3">{i.brand}</td>
                  <td className="px-4 py-3">{i.category}</td>
                  <td className="px-4 py-3">{i.color}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${LEVEL_CLASS[levelOf(i)]}`}>
                    <span>{i.quantity}</span>
                    <span className="ml-2 text-[10px] tracking-luxe uppercase">
                      {LEVEL_LABEL[levelOf(i)]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatBRL(i.price)}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] tracking-luxe uppercase">
                      {i.active ? "Ativo" : "Inativo"}
                      {i.featured ? " · Destaque" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2 text-[10px] tracking-luxe uppercase">
                      <button disabled className="opacity-40 cursor-not-allowed">Editar</button>
                      <button disabled className="opacity-40 cursor-not-allowed">Duplicar</button>
                      <button disabled className="opacity-40 cursor-not-allowed">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
        CRUD completo integra o próximo sprint. Estrutura pronta para receber a persistência.
      </p>
    </>
  );
}