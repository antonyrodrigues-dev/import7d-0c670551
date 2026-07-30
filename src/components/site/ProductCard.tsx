import { memo, useState } from "react";
import { formatBRL, useCatalog, type PublicProduct } from "@/features/catalog";
import { ProductSheet } from "./ProductSheet";
import { EmptyState, LoadingState } from "@/features/admin/components/AdminUI";

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
        <img
          src={p.image}
          alt={p.name}
          width={896}
          height={1152}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain transition-all duration-[600ms] ease-out group-hover:scale-[1.02] group-hover:opacity-0"
        />
        <img
          src={p.imageHover || p.image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain opacity-0 transition-all duration-[600ms] ease-out group-hover:scale-[1.02] group-hover:opacity-100"
        />
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
        <span className="font-display text-base tabular-nums text-[color:var(--forest-deep)] shrink-0">
          {formatBRL(p.price)}
        </span>
      </div>
    </button>
  );
});

export function FullGrid() {
  const { products, state } = useCatalog();
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const activeProduct = openSlug ? (products.find((p) => p.slug === openSlug) ?? null) : null;
  if (state === "loading" && products.length === 0) {
    return <LoadingState label="Carregando acervo…" />;
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
      <div className="grid gap-12 sm:grid-cols-2 md:gap-10 lg:grid-cols-3">
        {products.map((p, i) => (
          <Card key={p.slug} p={p} onOpen={setOpenSlug} index={i} />
        ))}
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
