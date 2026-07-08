import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PackagePlus, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/data/products";
import { PageHeader, Skeleton } from "@/features/admin/components/PageHeader";
import { EmptyState } from "@/features/admin/components/AdminUI";
import { Button } from "@/components/ui/button";
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
      <PageHeader
        eyebrow="Painel"
        title="Estoque"
        description="Cadastro, quantidade e destaque dos produtos."
        actions={
          <Button
            onClick={() => toast.info("Cadastro de produto disponível em breve no painel.")}
          >
            <PackagePlus className="h-4 w-4" aria-hidden="true" />
            Novo produto
          </Button>
        }
      />

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
        <EmptyState
          icon={<PackageSearch className="h-5 w-5" />}
          title={
            items.length === 0
              ? "Nenhum produto cadastrado"
              : "Nenhum produto neste filtro"
          }
          description={
            items.length === 0
              ? "Cadastre o primeiro produto para começar o gerenciamento do estoque."
              : "Ajuste os filtros para localizar o produto desejado."
          }
          action={
            items.length === 0 ? (
              <Button
                onClick={() =>
                  toast.info("Cadastro de produto disponível em breve no painel.")
                }
              >
                <PackagePlus className="h-4 w-4" aria-hidden="true" />
                Novo produto
              </Button>
            ) : undefined
          }
        />
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}