import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { priceLabel, featuredOf, useCatalog, type PublicProduct } from "@/features/catalog";
import { ProductSheet } from "./ProductSheet";
import { SafeImage } from "./SafeImage";

function Slide({ p, onOpen }: { p: PublicProduct; onOpen: (slug: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(p.slug)}
      data-testid={`product-card-${p.slug}`}
      aria-label={`Ver detalhes — ${p.name}`}
      className="group relative block min-w-0 shrink-0 grow-0 basis-[87%] pl-6 text-left transition-transform duration-500 ease-out hover:-translate-y-1 active:scale-[0.99] sm:basis-1/2 lg:basis-1/3 md:pl-10"
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
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[color:var(--forest-deep)]/25 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-4 left-4 inline-flex items-center gap-2 text-[10px] tracking-luxe uppercase text-[color:var(--cream)] opacity-0 translate-y-1 transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100"
        >
          {p.compravel ? "Ver peça" : "Ver detalhes"}
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
}

export function FeaturedCarousel() {
  const { products } = useCatalog();
  const featured = useMemo(() => {
    const destaques = featuredOf(products);
    // Destaques prontos para reserva primeiro; a seção nunca fica vazia
    // enquanto o acervo estiver em conferência.
    const base = destaques.length > 0 ? destaques : products;
    return [...base].sort((a, b) => Number(b.compravel) - Number(a.compravel)).slice(0, 12);
  }, [products]);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  // Embla resolve sozinho: resize (via ResizeObserver interno), drag/swipe,
  // limites reais de scroll e re-cálculo após carga assíncrona (reInit).
  const [emblaRef, embla] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    slidesToScroll: 1,
    dragFree: false,
  });

  const onSelect = useCallback(() => {
    if (!embla) return;
    setCanPrev(embla.canScrollPrev());
    setCanNext(embla.canScrollNext());
    setActiveIndex(embla.selectedScrollSnap());
    setSnapCount(embla.scrollSnapList().length);
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    onSelect();
    embla.on("select", onSelect);
    embla.on("reInit", onSelect);
    return () => {
      embla.off("select", onSelect);
      embla.off("reInit", onSelect);
    };
  }, [embla, onSelect]);

  // Carga assíncrona do catálogo: recalcula depois do layout aplicado.
  useEffect(() => {
    if (!embla) return;
    const raf = requestAnimationFrame(() => embla.reInit());
    return () => cancelAnimationFrame(raf);
  }, [embla, featured.length]);

  const scrollPrev = () => embla?.scrollPrev();
  const scrollNext = () => embla?.scrollNext();
  const goTo = (i: number) => embla?.scrollTo(i);

  /** Sem overflow real: nenhum controle é renderizado (nada desabilitado à toa). */
  const hasOverflow = snapCount > 1;

  if (featured.length === 0) return null;

  return (
    <div
      className="relative"
      data-testid="featured-carousel"
      data-overflow={hasOverflow ? "true" : "false"}
      data-index={activeIndex}
      role="region"
      aria-roledescription="carrossel"
      aria-label="Peças em destaque"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          scrollNext();
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          scrollPrev();
        }
      }}
    >
      <div
        ref={emblaRef}
        className="-mx-6 overflow-hidden px-6 pb-6 md:-mx-12 md:px-12"
        data-testid="featured-viewport"
      >
        <div className="-ml-6 flex touch-pan-y md:-ml-10">
          {featured.map((p) => (
            <Slide key={p.slug} p={p} onOpen={setOpenSlug} />
          ))}
        </div>
      </div>

      {hasOverflow && (
        <div className="mt-10 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2" role="tablist" aria-label="Peças em destaque">
            {Array.from({ length: snapCount }).map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                data-testid={`carousel-dot-${i}`}
                aria-selected={i === activeIndex}
                aria-label={`Ir para o grupo ${i + 1}`}
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
              onClick={scrollPrev}
              disabled={!canPrev}
              aria-label="Anterior"
              data-testid="carousel-prev"
              className="flex h-11 w-11 items-center justify-center border border-[color:var(--forest-deep)]/30 text-[color:var(--forest-deep)] transition-all duration-300 hover:border-[color:var(--forest-vivid)] hover:text-[color:var(--forest-vivid)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={scrollNext}
              disabled={!canNext}
              aria-label="Próximo"
              data-testid="carousel-next"
              className="flex h-11 w-11 items-center justify-center border border-[color:var(--forest-deep)]/30 text-[color:var(--forest-deep)] transition-all duration-300 hover:border-[color:var(--forest-vivid)] hover:text-[color:var(--forest-vivid)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

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
