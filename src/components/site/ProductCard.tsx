import { memo, useEffect, useMemo, useState } from "react";
import {
  categoriesOf,
  priceLabel,
  productPublicState,
  useCatalog,
  type PublicProduct,
} from "@/features/catalog";
import { ProductSheet } from "./ProductSheet";
import { SafeImage } from "./SafeImage";
import { EmptyState, LoadingState } from "@/features/admin/components/AdminUI";

/** Lote de peças exibidas por vez no acervo — evita render de 52 cards de uma vez. */
const PAGE_SIZE = 9;

type SortKey = "curadoria" | "preco_asc" | "preco_desc" | "nome";
type Disponibilidade = "todas" | "reservaveis" | "sob_consulta";

const SORT_LABEL: Record<SortKey, string> = {
  curadoria: "Curadoria",
  preco_asc: "Menor preço",
  preco_desc: "Maior preço",
  nome: "A–Z",
};

const DISPONIBILIDADE_LABEL: Record<Disponibilidade, string> = {
  todas: "Todas",
  reservaveis: "Prontas para reserva",
  sob_consulta: "Sob consulta",
};

const Card = memo(function Card({
  p,
  onOpen,
  index,
}: {
  p: PublicProduct;
  onOpen: (slug: string) => void;
  index: number;
}) {
  const numeral = String(index + 1).padStart(2, "0");
  const status = productPublicState(p);
  return (
    <button
      type="button"
      onClick={() => onOpen(p.slug)}
      data-testid={`product-card-${p.slug}`}
      className="group block w-full text-left transition-transform duration-500 ease-out hover:-translate-y-1 active:scale-[0.99]"
      aria-label={`Ver detalhes — ${p.name}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[color:var(--cream-deep)]">
        <SafeImage
          src={p.image}
          alt={p.name}
          className="absolute inset-0 h-full w-full object-contain transition-all duration-[600ms] ease-out group-hover:scale-[1.02] group-hover:opacity-0"
        />
        <SafeImage
          src={p.imageHover || p.image}
          alt={p.name}
          hidden
          fallback={false}
          className="absolute inset-0 h-full w-full object-contain opacity-0 transition-all duration-[600ms] ease-out group-hover:scale-[1.02] group-hover:opacity-100"
        />
        {status.state !== "disponivel" ? (
          <span
            data-testid="badge-preview"
            className={`pointer-events-none absolute right-4 top-4 px-3 py-1 text-[9px] tracking-luxe uppercase ${
              status.state === "esgotado"
                ? "bg-[color:var(--forest-deep)]/85 text-[color:var(--cream)]"
                : "bg-[color:var(--cream)]/95 text-[color:var(--forest-deep)]"
            }`}
          >
            {status.label}
          </span>
        ) : null}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-4 left-4 font-display text-[11px] tabular-nums text-[color:var(--forest-deep)]/45"
        >
          N° {numeral}
        </span>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[color:var(--forest-deep)]/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-4 left-4 inline-flex items-center gap-2 text-[10px] tracking-luxe uppercase text-[color:var(--cream)] opacity-0 translate-y-1 transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100"
        >
          Ver peça
          <span className="inline-block h-px w-6 bg-[color:var(--gold)]" />
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px scale-x-0 origin-left bg-[color:var(--gold)] transition-transform duration-700 group-hover:scale-x-100"
        />
      </div>
      <div className="mt-5 flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            {p.brand ? `${p.brand} · ` : ""}
            {p.category}
          </p>
          <h3 className="mt-1 truncate font-display text-xl text-[color:var(--forest-deep)] transition-colors duration-300 group-hover:text-[color:var(--forest)]">
            {p.name}
          </h3>
        </div>
        <span
          className={`shrink-0 font-display font-medium text-[color:var(--forest-deep)] ${
            p.precoConfirmado
              ? "text-lg tabular-nums"
              : "text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]"
          }`}
        >
          {priceLabel(p)}
        </span>
      </div>
    </button>
  );
});

/** Painel editorial de filtros — categoria, marca, disponibilidade e ordem. */
function FilterPanel({
  categories,
  brands,
  category,
  brand,
  disponibilidade,
  sort,
  total,
  onCategory,
  onBrand,
  onDisponibilidade,
  onSort,
  onReset,
}: {
  categories: string[];
  brands: string[];
  category: string;
  brand: string;
  disponibilidade: Disponibilidade;
  sort: SortKey;
  total: number;
  onCategory: (v: string) => void;
  onBrand: (v: string) => void;
  onDisponibilidade: (v: Disponibilidade) => void;
  onSort: (v: SortKey) => void;
  onReset: () => void;
}) {
  const dirty =
    category !== "todas" ||
    brand !== "todas" ||
    disponibilidade !== "todas" ||
    sort !== "curadoria";
  const selectClass =
    "h-11 w-full appearance-none border border-[color:var(--forest-deep)]/20 bg-transparent px-4 text-[11px] tracking-luxe uppercase text-[color:var(--forest-deep)] transition-colors duration-300 hover:border-[color:var(--forest-deep)] focus:outline-none focus:ring-1 focus:ring-[color:var(--forest-vivid)]";

  return (
    <div className="mb-12 border-y border-[color:var(--forest-deep)]/15 bg-[color:var(--cream)]/40 px-5 py-6 backdrop-blur-[2px] md:px-8">
      {categories.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {["todas", ...categories].map((c) => {
            const active = c === category;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onCategory(c)}
                aria-pressed={active}
                className={`h-10 px-5 text-[10px] tracking-luxe uppercase transition-all duration-300 ${
                  active
                    ? "bg-[color:var(--forest-vivid)] text-[color:var(--cream)]"
                    : "border border-[color:var(--forest-deep)]/20 text-[color:var(--forest-deep)] hover:border-[color:var(--forest-deep)]"
                }`}
              >
                {c === "todas" ? "Todas" : c}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-center">
        <label className="block">
          <span className="mb-2 block text-[9px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Marca
          </span>
          <select
            value={brand}
            onChange={(e) => onBrand(e.target.value)}
            className={selectClass}
            aria-label="Filtrar por marca"
          >
            <option value="todas">Todas as marcas</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-[9px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Disponibilidade
          </span>
          <select
            value={disponibilidade}
            onChange={(e) => onDisponibilidade(e.target.value as Disponibilidade)}
            className={selectClass}
            aria-label="Filtrar por disponibilidade"
          >
            {(Object.keys(DISPONIBILIDADE_LABEL) as Disponibilidade[]).map((k) => (
              <option key={k} value={k}>
                {DISPONIBILIDADE_LABEL[k]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-[9px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Ordenar
          </span>
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as SortKey)}
            className={selectClass}
            aria-label="Ordenar acervo"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center justify-between gap-4 lg:justify-end">
          <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            {total} {total === 1 ? "peça" : "peças"}
          </span>
          {dirty && (
            <button
              type="button"
              onClick={onReset}
              className="text-[10px] tracking-luxe uppercase text-[color:var(--forest-vivid)] underline-offset-4 hover:underline"
            >
              Limpar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function FullGrid() {
  const { products, state, error, refresh } = useCatalog();
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("todas");
  const [brand, setBrand] = useState<string>("todas");
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade>("todas");
  const [sort, setSort] = useState<SortKey>("curadoria");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const activeProduct = openSlug ? (products.find((p) => p.slug === openSlug) ?? null) : null;

  const categories = useMemo(() => categoriesOf(products).sort(), [products]);
  const brands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(),
    [products],
  );

  const filtered = useMemo(() => {
    const base = products.filter((p) => {
      if (category !== "todas" && p.category !== category) return false;
      if (brand !== "todas" && p.brand !== brand) return false;
      if (disponibilidade === "reservaveis" && !p.compravel) return false;
      if (disponibilidade === "sob_consulta" && p.compravel) return false;
      return true;
    });
    const ordered = [...base];
    if (sort === "preco_asc") {
      ordered.sort(
        (a, b) => Number(b.precoConfirmado) - Number(a.precoConfirmado) || a.price - b.price,
      );
    } else if (sort === "preco_desc") {
      ordered.sort(
        (a, b) => Number(b.precoConfirmado) - Number(a.precoConfirmado) || b.price - a.price,
      );
    } else if (sort === "nome") {
      ordered.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    } else {
      // Curadoria: peças prontas para reserva primeiro; as demais seguem visíveis.
      ordered.sort((a, b) => Number(b.compravel) - Number(a.compravel));
    }
    return ordered;
  }, [products, category, brand, disponibilidade, sort]);

  useEffect(() => setVisible(PAGE_SIZE), [category, brand, disponibilidade, sort]);

  if (state === "loading" && products.length === 0) {
    return <LoadingState label="Carregando acervo…" />;
  }
  if (state === "error" && products.length === 0) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="font-display text-2xl text-[color:var(--forest-deep)]">
          Não conseguimos carregar o acervo
        </p>
        <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
          {error ?? "Verifique sua conexão e tente novamente."}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-8 inline-flex h-12 items-center px-8 text-[11px] tracking-luxe uppercase text-[color:var(--cream)] transition-colors duration-300 bg-[color:var(--forest-vivid)] hover:bg-[color:var(--forest-hover)]"
        >
          Tentar novamente
        </button>
      </div>
    );
  }
  if (state === "ready" && products.length === 0) {
    return (
      <EmptyState
        title="Sem peças disponíveis"
        description="Volte em breve para conferir novidades."
      />
    );
  }
  return (
    <>
      <FilterPanel
        categories={categories}
        brands={brands}
        category={category}
        brand={brand}
        disponibilidade={disponibilidade}
        sort={sort}
        total={filtered.length}
        onCategory={setCategory}
        onBrand={setBrand}
        onDisponibilidade={setDisponibilidade}
        onSort={setSort}
        onReset={() => {
          setCategory("todas");
          setBrand("todas");
          setDisponibilidade("todas");
          setSort("curadoria");
        }}
      />
      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma peça com esses filtros"
          description="Ajuste marca, categoria ou disponibilidade para ver mais peças do acervo."
        />
      ) : (
        <>
          <div className="grid gap-12 sm:grid-cols-2 md:gap-10 lg:grid-cols-3">
            {filtered.slice(0, visible).map((p, i) => (
              <Card key={p.slug} p={p} onOpen={setOpenSlug} index={i} />
            ))}
          </div>
          <div className="mt-16 flex flex-col items-center gap-5">
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              Mostrando {Math.min(visible, filtered.length)} de {filtered.length}{" "}
              {filtered.length === 1 ? "peça" : "peças"}
            </p>
            {visible < filtered.length && (
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="group inline-flex h-14 items-center gap-3 border border-[color:var(--forest-deep)]/30 px-10 text-[11px] tracking-luxe uppercase text-[color:var(--forest-deep)] transition-all duration-500 hover:border-[color:var(--forest-vivid)] hover:text-[color:var(--forest-vivid)]"
              >
                Ver mais peças
                <span
                  aria-hidden="true"
                  className="h-px w-8 bg-[color:var(--gold)] transition-all duration-500 group-hover:w-12"
                />
              </button>
            )}
          </div>
        </>
      )}
      {activeProduct && (
        <ProductSheet
          key={activeProduct.slug}
          product={activeProduct}
          open={!!activeProduct}
          onOpenChange={(o) => setOpenSlug(o ? activeProduct.slug : null)}
        />
      )}
    </>
  );
}
