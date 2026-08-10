import { memo, useEffect, useMemo, useState } from "react";
import { categoriesOf, formatBRL, useCatalog, type PublicProduct } from "@/features/catalog";
import { ProductSheet } from "./ProductSheet";
import { EmptyState, LoadingState } from "@/features/admin/components/AdminUI";

/** Lote de peças exibidas por vez no acervo — evita render de 52 cards de uma vez. */
const PAGE_SIZE = 9;

/**
 * Imagem com fallback.
 *
 * `fallback` só é permitido na imagem PRINCIPAL. A imagem de hover, quando
 * falha, simplesmente não é renderizada — nunca sobrepõe a principal com a
 * moldura "7D" (bug confirmado em produção).
 */
function CardImage({
  src,
  alt,
  hidden,
  className,
  fallback = true,
}: {
  src: string;
  alt: string;
  hidden?: boolean;
  className: string;
  fallback?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    if (!fallback) return null;
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center bg-[color:var(--cream-deep)]"
      >
        <span className="font-display text-[11px] tracking-luxe uppercase text-[color:var(--forest-deep)]/35">
          7D
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={hidden ? "" : alt}
      aria-hidden={hidden ? "true" : undefined}
      width={896}
      height={1152}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

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
  return (
    <button
      type="button"
      onClick={() => onOpen(p.slug)}
      data-testid={`product-card-${p.slug}`}
      className="group block w-full text-left transition-transform duration-500 ease-out hover:-translate-y-1 active:scale-[0.99]"
      aria-label={`Ver detalhes — ${p.name}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[color:var(--cream-deep)]">
        <CardImage
          src={p.image}
          alt={p.name}
          className="absolute inset-0 h-full w-full object-contain transition-all duration-[600ms] ease-out group-hover:scale-[1.02] group-hover:opacity-0"
        />
        <CardImage
          src={p.imageHover || p.image}
          alt={p.name}
          hidden
          className="absolute inset-0 h-full w-full object-contain opacity-0 transition-all duration-[600ms] ease-out group-hover:scale-[1.02] group-hover:opacity-100"
        />
        {p.stock === 0 && (
          <span className="pointer-events-none absolute right-4 top-4 bg-[color:var(--forest-deep)]/85 px-3 py-1 text-[9px] tracking-luxe uppercase text-[color:var(--cream)]">
            Reservado
          </span>
        )}
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
          <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            {p.category}
          </p>
          <h3 className="mt-1 truncate font-display text-xl text-[color:var(--forest-deep)] transition-colors duration-300 group-hover:text-[color:var(--forest)]">
            {p.name}
          </h3>
        </div>
        <span className="shrink-0 font-display text-lg tabular-nums font-medium text-[color:var(--forest-deep)]">
          {formatBRL(p.price)}
        </span>
      </div>
    </button>
  );
});

export function FullGrid() {
  const { products, state, error, refresh } = useCatalog();
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("todas");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const activeProduct = openSlug ? (products.find((p) => p.slug === openSlug) ?? null) : null;

  const categories = useMemo(() => categoriesOf(products).sort(), [products]);
  const filtered = useMemo(
    () => (category === "todas" ? products : products.filter((p) => p.category === category)),
    [products, category],
  );

  useEffect(() => setVisible(PAGE_SIZE), [category]);

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
      {categories.length > 1 && (
        <div className="mb-12 flex flex-wrap items-center justify-center gap-3">
          {["todas", ...categories].map((c) => {
            const active = c === category;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={active}
                className={`h-10 px-5 text-[10px] tracking-luxe uppercase transition-all duration-300 ${
                  active
                    ? "bg-[color:var(--forest-vivid)] text-[color:var(--cream)]"
                    : "border border-[color:var(--forest-deep)]/25 text-[color:var(--forest-deep)] hover:border-[color:var(--forest-deep)]"
                }`}
              >
                {c === "todas" ? "Todas" : c}
              </button>
            );
          })}
        </div>
      )}
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
