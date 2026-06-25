import { Reveal } from "./Reveal";
import { FeaturedGrid, FullGrid } from "./ProductCard";
import catalogBg from "@/assets/catalog-bg.asset.json";
import { useReserva } from "@/store/reserva";

export function FeaturedSection() {
  return (
    <section className="relative bg-[color:var(--cream)] py-24 md:py-32">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <Reveal className="mb-14 flex items-end justify-between gap-6">
          <div>
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">Coleção em destaque</p>
            <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] text-[color:var(--forest-deep)]">Peças desta estação</h2>
          </div>
          <a href="#acervo" className="hidden md:inline-flex items-center gap-3 text-[11px] tracking-luxe uppercase text-[color:var(--forest-deep)] group">
            Ver acervo completo
            <span aria-hidden="true" className="h-px w-8 bg-current transition-all group-hover:w-12" />
          </a>
        </Reveal>
        <FeaturedGrid />
      </div>
    </section>
  );
}

export function CatalogSection() {
  return (
    <section id="acervo" className="relative overflow-hidden bg-[color:var(--cream-deep)] py-24 md:py-32">
      <img src={catalogBg.url} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-[0.18]" />
      <div className="relative mx-auto max-w-[1280px] px-6 md:px-12">
        <Reveal className="mb-14 text-center">
          <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">Acervo</p>
          <h2 className="mt-4 font-display text-[clamp(2.25rem,5vw,3.75rem)] text-[color:var(--forest-deep)]">Galeria editorial</h2>
          <p className="mx-auto mt-5 max-w-xl font-display italic text-lg text-[color:var(--muted-foreground)]">
            Cada item é numerado e reservado individualmente. Toque para abrir a ficha.
          </p>
        </Reveal>
        <FullGrid />
      </div>
    </section>
  );
}

const DIFERENCIAIS = [
  { t: "Curadoria", d: "Cada peça é avaliada por critérios de tecido, corte, origem e assinatura." },
  { t: "Numeração", d: "Estoque limitado. Reserva exclusiva por atendimento privado." },
  { t: "Entrega", d: "Embalagem editorial e envio rastreado para todo o Brasil." },
];

export function DiferenciaisSection() {
  return (
    <section className="bg-[color:var(--cream)] py-24 md:py-32">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <Reveal className="mb-16">
          <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">A casa</p>
          <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] text-[color:var(--forest-deep)]">Três compromissos.</h2>
        </Reveal>
        <div className="grid gap-12 md:grid-cols-3 md:gap-16">
          {DIFERENCIAIS.map((d, i) => (
            <Reveal key={d.t} delay={i * 0.1}>
              <div className="flex items-baseline gap-4">
                <span className="font-display text-2xl tabular-nums text-[color:var(--gold)]">0{i + 1}</span>
                <h3 className="font-display text-2xl text-[color:var(--forest-deep)]">{d.t}</h3>
              </div>
              <div aria-hidden="true" className="my-5 h-px bg-[color:var(--border)]" />
              <p className="text-[color:var(--muted-foreground)] leading-relaxed">{d.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AtendimentoSection() {
  const setOpen = useReserva((s) => s.setOpen);
  return (
    <section id="atendimento" className="relative bg-[color:var(--forest-deep)] py-24 md:py-32 text-[color:var(--cream)]">
      <div className="mx-auto max-w-[920px] px-6 text-center md:px-12">
        <Reveal>
          <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">Atendimento</p>
          <h2 className="mt-5 font-display text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.05]">
            Cada reserva começa com uma conversa.
          </h2>
          <p className="mx-auto mt-6 max-w-xl font-display italic text-lg text-[color:var(--cream)]/80">
            Selecione suas peças, finalize pela reserva e nossa curadoria continua com você no WhatsApp.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <button
            onClick={() => setOpen(true)}
            className="mt-12 inline-flex h-14 items-center gap-3 border border-[color:var(--cream)]/70 px-10 text-[11px] tracking-luxe uppercase transition-all duration-500 hover:bg-[color:var(--cream)] hover:text-[color:var(--forest-deep)] active:scale-[0.98]"
          >
            <span>Abrir minha reserva</span>
            <span aria-hidden="true" className="h-px w-8 bg-current transition-all duration-500 group-hover:w-12" />
          </button>
        </Reveal>
      </div>
    </section>
  );
}