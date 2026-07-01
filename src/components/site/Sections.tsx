import { Reveal } from "./Reveal";
import { FullGrid } from "./ProductCard";
import { FeaturedCarousel } from "./FeaturedCarousel";
import catalogBg from "@/assets/catalog-bg.asset.json";
import { useReserva } from "@/store/reserva";
import { BRAND } from "@/config/attendants";
import { Instagram, MapPin, MessageCircle, Clock, ArrowUpRight } from "lucide-react";

export function FeaturedSection() {
  return (
    <section className="relative bg-[color:var(--cream)] py-24 md:py-32">
      <div className="mx-auto max-w-[1440px] px-6 md:px-12">
        <Reveal className="mb-14 flex items-end justify-between gap-6">
          <div>
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">Estação</p>
            <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] text-[color:var(--forest-deep)]">Peças em destaque</h2>
          </div>
          <a href="#acervo" className="group hidden md:inline-flex items-center gap-3 text-[11px] tracking-luxe uppercase text-[color:var(--forest-deep)]">
            Ver acervo completo
            <span aria-hidden="true" className="h-px w-8 bg-[color:var(--gold)] transition-all duration-500 group-hover:w-14" />
          </a>
        </Reveal>
        <FeaturedCarousel />
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
          <h2 className="mt-4 font-display text-[clamp(2.25rem,5vw,3.75rem)] text-[color:var(--forest-deep)]">O acervo, por inteiro</h2>
          <p className="mx-auto mt-5 max-w-xl font-display italic text-lg text-[color:var(--muted-foreground)]">
            Cada peça é numerada e reservada individualmente. Toque para abrir a ficha.
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
              <div className="group relative cursor-default border-t border-[color:var(--border)] pt-6 transition-colors duration-500 hover:border-[color:var(--gold)]">
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-0 h-px w-0 bg-[color:var(--gold)] transition-[width] duration-700 ease-out group-hover:w-full"
                />
                <div className="flex items-baseline gap-4">
                  <span className="font-display text-2xl tabular-nums text-[color:var(--gold)] transition-transform duration-500 group-hover:-translate-y-0.5">
                    0{i + 1}
                  </span>
                  <h3 className="font-display text-2xl text-[color:var(--forest-deep)]">{d.t}</h3>
                </div>
                <p className="mt-5 leading-relaxed text-[color:var(--muted-foreground)] transition-colors duration-500 group-hover:text-[color:var(--forest-deep)]">
                  {d.d}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AtendimentoSection() {
  const setOpen = useReserva((s) => s.setOpen);
  const channels = [
    { icon: MessageCircle, label: "WhatsApp", value: BRAND.whatsapp.label, href: BRAND.whatsapp.url, external: true },
    { icon: Instagram, label: "Instagram", value: BRAND.instagram.handle, href: BRAND.instagram.url, external: true },
    { icon: MapPin, label: "Atelier", value: BRAND.address.line, href: BRAND.address.mapsUrl, external: true },
    { icon: Clock, label: "Horário", value: BRAND.hours, href: null, external: false },
  ];

  return (
    <section id="atendimento" className="relative bg-[color:var(--forest-deep)] py-24 md:py-32 text-[color:var(--cream)]">
      <div className="mx-auto max-w-[1080px] px-6 md:px-12">
        <Reveal className="text-center">
          <p className="text-[11px] font-medium tracking-[0.4em] uppercase text-[color:var(--gold)]">Atendimento</p>
          <h2 className="mx-auto mt-5 max-w-2xl font-display text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.05]">
            Cada reserva começa com uma conversa.
          </h2>
          <p className="mx-auto mt-6 max-w-xl font-display italic text-lg text-[color:var(--cream)]/80">
            Atendimento privado e personalizado. Selecione as peças e seguimos a curadoria com você.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <ul className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-x-14 gap-y-2 border-y border-[color:var(--cream)]/15 sm:grid-cols-2">
            {channels.map(({ icon: Icon, label, value, href, external }) => {
              const inner = (
                <div className="group flex items-center gap-5 py-6 transition-all duration-500">
                  <Icon className="h-[18px] w-[18px] shrink-0 text-[color:var(--gold)]" strokeWidth={1.4} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] tracking-luxe uppercase text-[color:var(--cream)]/55">{label}</p>
                    <p className="mt-1 truncate font-display text-lg text-[color:var(--cream)]">{value}</p>
                  </div>
                  {href && (
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-[color:var(--cream)]/40 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[color:var(--gold)]"
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
              return (
                <li key={label} className="border-b border-[color:var(--cream)]/10 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
                  {href ? (
                    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
                      {inner}
                    </a>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </Reveal>

        <Reveal delay={0.25} className="mt-14 flex justify-center">
          <button
            onClick={() => setOpen(true)}
            className="group inline-flex h-14 items-center gap-3 border border-[color:var(--cream)]/70 px-10 text-[11px] tracking-luxe uppercase transition-all duration-500 hover:bg-[color:var(--cream)] hover:text-[color:var(--forest-deep)] active:scale-[0.99]"
          >
            <span>Abrir minha reserva</span>
            <span aria-hidden="true" className="h-px w-8 bg-current transition-all duration-500 group-hover:w-12" />
          </button>
        </Reveal>
      </div>
    </section>
  );
}