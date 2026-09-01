import { memo, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Search, SlidersHorizontal, X } from "lucide-react";
import {
  categoriesOf,
  formatBRL,
  priceLabel,
  productPublicState,
  useCatalog,
  type PublicProduct,
} from "@/features/catalog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
      <div className="mt-6">
        <p className="truncate text-[11px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          {p.brand ? `${p.brand} · ` : ""}
          {p.category}
        </p>
        <h3 className="mt-3 line-clamp-2 font-display text-2xl leading-snug text-[color:var(--forest-deep)] transition-colors duration-300 group-hover:text-[color:var(--forest)] md:text-3xl">
          {p.name}
        </h3>
        <p
          className={`mt-4 font-display font-medium text-[color:var(--forest-deep)] ${
            p.precoConfirmado
              ? "text-xl tabular-nums md:text-2xl"
              : "text-[11px] tracking-luxe uppercase text-[color:var(--muted-foreground)]"
          }`}
        >
          {priceLabel(p)}
        </p>
      </div>

    </button>
  );
});

interface Filters {
  category: string;
  brand: string;
  size: string;
  disponibilidade: Disponibilidade;
  priceMax: number | null;
}

const EMPTY_FILTERS: Filters = {
  category: "todas",
  brand: "todas",
  size: "todos",
  disponibilidade: "todas",
  priceMax: null,
};

function activeChips(f: Filters): { key: keyof Filters; label: string }[] {
  const chips: { key: keyof Filters; label: string }[] = [];
  if (f.category !== "todas") chips.push({ key: "category", label: f.category });
  if (f.brand !== "todas") chips.push({ key: "brand", label: f.brand });
  if (f.size !== "todos") chips.push({ key: "size", label: `Tam ${f.size}` });
  if (f.disponibilidade !== "todas")
    chips.push({ key: "disponibilidade", label: DISPONIBILIDADE_LABEL[f.disponibilidade] });
  if (f.priceMax != null) chips.push({ key: "priceMax", label: `Até ${formatBRL(f.priceMax)}` });
  return chips;
}

const optionClass = (active: boolean) =>
  `h-9 px-4 text-[10px] tracking-luxe uppercase transition-colors duration-300 ${
    active
      ? "bg-[color:var(--forest-vivid)] text-[color:var(--cream)]"
      : "border border-[color:var(--forest-deep)]/20 text-[color:var(--forest-deep)] hover:border-[color:var(--forest-deep)]"
  }`;

/**
 * Painel de filtros — TODAS as categorias vivem aqui dentro. O acervo nunca
 * exibe a parede permanente de categorias.
 */
function FiltersSheet({
  open,
  onOpenChange,
  categories,
  brands,
  sizes,
  priceCeiling,
  value,
  onChange,
  total,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: string[];
  brands: string[];
  sizes: string[];
  priceCeiling: number;
  value: Filters;
  onChange: (f: Filters) => void;
  total: number;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-md flex-col overflow-y-auto bg-[color:var(--cream)] p-0"
        data-testid="acervo-filtros-panel"
      >
        <SheetHeader className="border-b border-[color:var(--border)] px-6 py-5 text-left">
          <SheetTitle className="font-display text-2xl text-[color:var(--forest-deep)]">
            Filtros
          </SheetTitle>
          <SheetDescription className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            {total} {total === 1 ? "peça" : "peças"} no resultado
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-8 px-6 py-6">
          <fieldset>
            <legend className="mb-3 text-[9px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              Categoria
            </legend>
            <div className="flex flex-wrap gap-2" data-testid="acervo-filtro-categorias">
              {["todas", ...categories].map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={c === value.category}
                  onClick={() => onChange({ ...value, category: c })}
                  className={optionClass(c === value.category)}
                >
                  {c === "todas" ? "Todas" : c}
                </button>
              ))}
            </div>
          </fieldset>

          {brands.length > 0 && (
            <fieldset>
              <legend className="mb-3 text-[9px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Marca
              </legend>
              <div className="flex flex-wrap gap-2">
                {["todas", ...brands].map((b) => (
                  <button
                    key={b}
                    type="button"
                    aria-pressed={b === value.brand}
                    onClick={() => onChange({ ...value, brand: b })}
                    className={optionClass(b === value.brand)}
                  >
                    {b === "todas" ? "Todas" : b}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {sizes.length > 0 && (
            <fieldset>
              <legend className="mb-3 text-[9px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Tamanho
              </legend>
              <div className="flex flex-wrap gap-2">
                {["todos", ...sizes].map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={s === value.size}
                    onClick={() => onChange({ ...value, size: s })}
                    className={optionClass(s === value.size)}
                  >
                    {s === "todos" ? "Todos" : s}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="mb-3 text-[9px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              Disponibilidade
            </legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DISPONIBILIDADE_LABEL) as Disponibilidade[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={k === value.disponibilidade}
                  onClick={() => onChange({ ...value, disponibilidade: k })}
                  className={optionClass(k === value.disponibilidade)}
                >
                  {DISPONIBILIDADE_LABEL[k]}
                </button>
              ))}
            </div>
          </fieldset>

          {priceCeiling > 0 && (
            <fieldset>
              <legend className="mb-3 text-[9px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Faixa de preço
              </legend>
              <input
                type="range"
                min={0}
                max={priceCeiling}
                step={50}
                value={value.priceMax ?? priceCeiling}
                onChange={(e) =>
                  onChange({
                    ...value,
                    priceMax:
                      Number(e.target.value) >= priceCeiling ? null : Number(e.target.value),
                  })
                }
                aria-label="Preço máximo"
                className="w-full accent-[color:var(--forest-vivid)]"
              />
              <p className="mt-2 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                {value.priceMax == null
                  ? "Todos os valores"
                  : `Até ${formatBRL(value.priceMax)} · peças sob consulta seguem visíveis`}
              </p>
            </fieldset>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-[color:var(--border)] bg-[color:var(--cream)] px-6 py-4">
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-[10px] tracking-luxe uppercase text-[color:var(--forest-vivid)] underline-offset-4 hover:underline"
          >
            Limpar filtros
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 bg-[color:var(--forest-vivid)] px-8 text-[10px] tracking-luxe uppercase text-[color:var(--cream)] transition-colors hover:bg-[color:var(--forest-hover)]"
          >
            Ver resultado
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function FullGrid() {
  const { products, state, error, refresh } = useCatalog();
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("curadoria");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const activeProduct = openSlug ? (products.find((p) => p.slug === openSlug) ?? null) : null;

  // Busca do site abre a PEÇA EXATA: `#peca-<slug>` é o contrato único.
  useEffect(() => {
    const sync = () => {
      const hash = decodeURIComponent(window.location.hash);
      if (hash.startsWith("#peca-")) setOpenSlug(hash.slice("#peca-".length));
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const categories = useMemo(() => categoriesOf(products).sort(), [products]);
  const brands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(),
    [products],
  );
  const sizes = useMemo(
    () => [...new Set(products.flatMap((p) => p.sizes))].filter(Boolean).sort(),
    [products],
  );
  const priceCeiling = useMemo(
    () =>
      Math.ceil(
        Math.max(0, ...products.filter((p) => p.precoConfirmado).map((p) => p.price)) / 50,
      ) * 50,
    [products],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const base = products.filter((p) => {
      if (filters.category !== "todas" && p.category !== filters.category) return false;
      if (filters.brand !== "todas" && p.brand !== filters.brand) return false;
      if (filters.size !== "todos" && !p.sizes.includes(filters.size)) return false;
      if (filters.disponibilidade === "reservaveis" && !p.compravel) return false;
      if (filters.disponibilidade === "sob_consulta" && p.compravel) return false;
      if (filters.priceMax != null && p.precoConfirmado && p.price > filters.priceMax) return false;
      if (
        term &&
        ![p.name, p.brand, p.category, p.description].some((f) => f?.toLowerCase().includes(term))
      )
        return false;
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
  }, [products, filters, sort, query]);

  useEffect(() => setVisible(PAGE_SIZE), [filters, sort, query]);

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

  const chips = activeChips(filters);
  const clearChip = (key: keyof Filters) =>
    setFilters({ ...filters, [key]: EMPTY_FILTERS[key] } as Filters);

  return (
    <>
      <div className="mb-10 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
          <label className="col-span-2 relative block flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted-foreground)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar peças…"
              aria-label="Buscar peças no acervo"
              data-testid="acervo-busca"
              className="h-12 w-full border border-[color:var(--forest-deep)]/20 bg-transparent pl-11 pr-4 text-sm text-[color:var(--forest-deep)] placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--forest-deep)] focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            data-testid="acervo-abrir-filtros"
            className="inline-flex h-12 items-center justify-center gap-2 border border-[color:var(--forest-deep)]/20 px-6 text-[10px] tracking-luxe uppercase text-[color:var(--forest-deep)] transition-colors hover:border-[color:var(--forest-deep)]"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filtros
            {chips.length > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center bg-[color:var(--forest-vivid)] px-1 text-[9px] text-[color:var(--cream)]">
                {chips.length}
              </span>
            )}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              aria-expanded={sortOpen}
              className="inline-flex h-12 w-full items-center justify-center gap-2 border border-[color:var(--forest-deep)]/20 px-6 text-[10px] tracking-luxe uppercase text-[color:var(--forest-deep)] transition-colors hover:border-[color:var(--forest-deep)]"
            >
              <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
              {SORT_LABEL[sort]}
            </button>
            {sortOpen && (
              <ul className="absolute right-0 z-30 mt-1 w-52 border border-[color:var(--forest-deep)]/20 bg-[color:var(--cream)] shadow-xl">
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => {
                        setSort(k);
                        setSortOpen(false);
                      }}
                      className={`block w-full px-5 py-3 text-left text-[10px] tracking-luxe uppercase transition-colors ${
                        k === sort
                          ? "bg-[color:var(--forest-vivid)] text-[color:var(--cream)]"
                          : "text-[color:var(--forest-deep)] hover:bg-[color:var(--cream-deep)]/60"
                      }`}
                    >
                      {SORT_LABEL[k]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Filtros aplicados">
            {chips.map((c) => (
              <button
                key={`${c.key}-${c.label}`}
                type="button"
                onClick={() => clearChip(c.key)}
                className="inline-flex h-8 items-center gap-2 border border-[color:var(--forest-deep)]/25 px-3 text-[10px] tracking-luxe uppercase text-[color:var(--forest-deep)] transition-colors hover:border-[color:var(--forest-deep)]"
              >
                {c.label}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-[10px] tracking-luxe uppercase text-[color:var(--forest-vivid)] underline-offset-4 hover:underline"
            >
              Limpar
            </button>
          </div>
        )}
      </div>

      <FiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        categories={categories}
        brands={brands}
        sizes={sizes}
        priceCeiling={priceCeiling}
        value={filters}
        onChange={setFilters}
        total={filtered.length}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma peça com esses filtros"
          description="Ajuste a busca ou os filtros para ver mais peças do acervo."
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
