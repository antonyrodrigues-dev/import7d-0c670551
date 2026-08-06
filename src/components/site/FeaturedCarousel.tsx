import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { formatBRL, featuredOf, useCatalog, type PublicProduct } from "@/features/catalog";
import { ProductSheet } from "./ProductSheet";

function Slide({ p, onOpen }: { p: PublicProduct; onOpen: (slug: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(p.slug)}
      data-testid={`product-card-${p.slug}`}
      aria-label={`Ver detalhes — ${p.name}`}
      className="group relative block w-[78vw] shrink-0 snap-center text-left transition-transform duration-500 ease-out hover:-translate-y-1 active:scale-[0.99] sm:w-[58vw] md:w-[42vw] lg:w-[32vw] xl:w-[28vw]"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[color:var(--cream-deep)]">
        <img
          src={p.image}
          alt={p.name}
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
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[color:var(--forest-deep)]/25 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
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
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-[color:var(--gold)] transition-transform duration-700 group-hover:scale-x-100"
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
        <span className="shrink-0 font-display text-lg font-medium tabular-nums text-[color:var(--forest-deep)]">
          {formatBRL(p.price)}
        </span>
      </div>
    </button>
  );
}

export function FeaturedCarousel() {
  const { products } = useCatalog();
  const featured = useMemo(() => featuredOf(products), [products]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const update = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    const first = el.firstElementChild as HTMLElement | null;
    const step = first ? first.getBoundingClientRect().width + 24 : el.clientWidth;
    setActiveIndex(step > 0 ? Math.round(el.scrollLeft / step) : 0);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.7;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    const target = el?.children[i] as HTMLElement | undefined;
    if (!el || !target) return;
    el.scrollTo({ left: target.offsetLeft - el.offsetLeft, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="-mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-6 scroll-smooth md:-mx-12 md:gap-10 md:px-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollPaddingInline: "1.5rem" }}
      >
        {featured.map((p) => (
          <Slide key={p.slug} p={p} onOpen={setOpenSlug} />
        ))}
        <div aria-hidden="true" className="shrink-0 pr-2" />
      </div>

      <div className="mt-10 flex items-center justify-between gap-6">
        <div className="flex items-center gap-2" role="tablist" aria-label="Peças em destaque">
          {featured.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Ir para ${p.name}`}
              onClick={() => goTo(i)}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === activeIndex
                  ? "w-8 bg-[color:var(--forest-vivid)]"
                  : "w-3 bg-[color:var(--forest-deep)]/20 hover:bg-[color:var(--forest-deep)]/40"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={!canPrev}
            aria-label="Anterior"
            className="flex h-11 w-11 items-center justify-center border border-[color:var(--forest-deep)]/30 text-[color:var(--forest-deep)] transition-all duration-300 hover:border-[color:var(--forest-vivid)] hover:text-[color:var(--forest-vivid)] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={!canNext}
            aria-label="Próximo"
            className="flex h-11 w-11 items-center justify-center border border-[color:var(--forest-deep)]/30 text-[color:var(--forest-deep)] transition-all duration-300 hover:border-[color:var(--forest-vivid)] hover:text-[color:var(--forest-vivid)] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {(() => {
        const active = openSlug ? featured.find((p) => p.slug === openSlug) : null;
        if (!active) return null;
        return (
          <ProductSheet
            key={active.slug}
            product={active}
            open={!!active}
            onOpenChange={(o) => setOpenSlug(o ? active.slug : null)}
          />
        );
      })()}
    </div>
  );
}
