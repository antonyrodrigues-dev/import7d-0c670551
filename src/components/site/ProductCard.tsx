import { memo, useState } from "react";
import { PRODUCTS, formatBRL, type Product } from "@/data/products";
import { ProductSheet } from "./ProductSheet";

const Card = memo(function Card({ p, onOpen }: { p: Product; onOpen: (slug: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(p.slug)}
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
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px scale-x-0 origin-left bg-[color:var(--gold)] transition-transform duration-500 group-hover:scale-x-100" />
      </div>
      <div className="mt-5 flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">{p.category}</p>
          <h3 className="mt-1 truncate font-display text-xl text-[color:var(--forest-deep)]">{p.name}</h3>
        </div>
        <span className="font-display text-base tabular-nums text-[color:var(--forest-deep)] shrink-0">{formatBRL(p.price)}</span>
      </div>
    </button>
  );
});

export function FullGrid() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const activeProduct = openSlug ? PRODUCTS.find((p) => p.slug === openSlug) ?? null : null;
  return (
    <>
      <div className="grid gap-12 sm:grid-cols-2 md:gap-10 lg:grid-cols-3">
        {PRODUCTS.map((p) => (
          <Card key={p.slug} p={p} onOpen={setOpenSlug} />
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