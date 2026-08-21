import { Reveal } from "./Reveal";
import { FullGrid } from "./ProductCard";
import { FeaturedCarousel } from "./FeaturedCarousel";
import catalogBg from "@/assets/catalog-bg.asset.json";
import { useReserva } from "@/store/reserva";
import { BRAND } from "@/config/attendants";
import { useStoreSettings } from "@/features/admin/hooks";
import {
  buildStoreWhatsAppUrl,
  formatBusinessHoursSummary,
} from "@/features/admin/services/settings.service";
import { formatPhoneBR } from "@/lib/masks";
import { Instagram, MapPin, MessageCircle, Clock, ArrowUpRight } from "lucide-react";

export function FeaturedSection() {
  return (
    <section className="relative bg-[color:var(--cream)] py-24 md:py-32">
      <div className="mx-auto max-w-[1440px] px-6 md:px-12">
        <Reveal className="mb-14 flex items-end justify-between gap-6">
          <div>
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">Estação</p>
            <h2 className="mt-4 font-display type-section text-[color:var(--forest-deep)]">
              Peças em destaque
            </h2>
          </div>
          <a
            href="#acervo"
            className="group hidden md:inline-flex items-center gap-3 text-[11px] tracking-luxe uppercase text-[color:var(--forest-deep)]"
          >
            Ver acervo completo
            <span
              aria-hidden="true"
              className="h-px w-8 bg-[color:var(--gold)] transition-all duration-500 group-hover:w-14"
            />
          </a>
        </Reveal>
        <FeaturedCarousel />
      </div>
    </section>
  );
}

export function CatalogSection() {
  return (
    <section
      id="acervo"
      className="relative overflow-hidden bg-[color:var(--cream-deep)] py-24 md:py-32"
    >
      <img
        src={catalogBg.url}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover opacity-[0.14]"
      />
      {/* Ambient wash — verde Lacoste sutil no topo/base para dar profundidade */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--forest-deep)_9%,transparent)_0%,transparent_55%),radial-gradient(ellipse_at_bottom,color-mix(in_oklab,var(--forest-deep)_6%,transparent)_0%,transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[color:var(--gold)]/40"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[color:var(--gold)]/40"
      />
      <div className="relative mx-auto max-w-[1280px] px-6 md:px-12">
        <Reveal className="mb-14">
          <div className="grid gap-8 border-b border-[color:var(--forest-deep)]/15 pb-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-4 text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">
                <span aria-hidden="true" className="h-px w-8 bg-[color:var(--gold)]/60" />
                Acervo · Edição corrente
              </p>
              <h2 className="mt-5 font-display type-section leading-[0.95] text-[color:var(--forest-deep)]">
                O acervo,
                <span className="block italic text-[color:var(--forest-vivid)]">por inteiro</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-[color:var(--muted-foreground)] md:text-right">
              Cada peça é numerada e reservada individualmente. Peças ainda em conferência entram na
              mesma reserva, como
              <span className="text-[color:var(--forest-deep)]"> sob consulta</span> — tamanho e
              valor são confirmados pela equipe no atendimento.
            </p>
          </div>
        </Reveal>
        <FullGrid />
      </div>
    </section>
  );
}

const DIFERENCIAIS = [
  {
    t: "Curadoria",
    d: "Cada peça é avaliada por critérios de tecido, corte, origem e assinatura.",
  },
  { t: "Numeração", d: "Estoque limitado. Reserva exclusiva por atendimento privado." },
  { t: "Entrega", d: "Embalagem editorial e envio rastreado para todo o Brasil." },
];

export function DiferenciaisSection() {
  return (
    <section className="bg-[color:var(--cream)] py-24 md:py-32">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <Reveal className="mb-16">
          <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">A casa</p>
          <h2 className="mt-4 font-display type-section text-[color:var(--forest-deep)]">
            Três compromissos.
          </h2>
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
  // Contatos, endereço e horário vêm das Configurações da loja (banco).
  const settings = useStoreSettings();
  const endereco = settings.endereco || BRAND.address.line;
  const channels = [
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: formatPhoneBR(settings.whatsapp) || BRAND.whatsapp.label,
      href: buildStoreWhatsAppUrl(settings.whatsapp),
      external: true,
    },
    {
      icon: Instagram,
      label: "Instagram",
      value: settings.instagram || BRAND.instagram.handle,
      href: `https://instagram.com/${(settings.instagram || BRAND.instagram.handle).replace("@", "")}`,
      external: true,
    },
    {
      icon: MapPin,
      label: "Atelier",
      value: endereco,
      href: `https://maps.google.com/?q=${encodeURIComponent(endereco)}`,
      external: true,
    },
    {
      icon: Clock,
      label: "Horário",
      value: formatBusinessHoursSummary(settings.businessHours) || BRAND.hours,
      href: null,
      external: false,
    },
  ];

  return (
    <section
      id="atendimento"
      className="relative overflow-hidden bg-[color:var(--forest-deep)] py-24 md:py-32 text-[color:var(--cream)]"
    >
      {/* Textura de papel/linho — extremamente sutil, não compete com o conteúdo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.85 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          backgroundSize: "220px 220px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--gold)_8%,transparent)_0%,transparent_55%),radial-gradient(ellipse_at_bottom,color-mix(in_oklab,var(--forest)_45%,transparent)_0%,transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[color:var(--gold)]/35"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[color:var(--gold)]/35"
      />
      <div className="relative mx-auto max-w-[1080px] px-6 md:px-12">
        <Reveal className="text-center">
          <p className="text-[11px] font-medium tracking-[0.4em] uppercase text-[color:var(--gold)]">
            Atendimento
          </p>
          <h2 className="mx-auto mt-5 max-w-2xl font-display type-section leading-[1.05]">
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
                  <Icon
                    className="h-[18px] w-[18px] shrink-0 text-[color:var(--gold)]"
                    strokeWidth={1.4}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] tracking-luxe uppercase text-[color:var(--cream)]/55">
                      {label}
                    </p>
                    <p className="mt-1 truncate font-display text-lg text-[color:var(--cream)]">
                      {value}
                    </p>
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
                <li
                  key={label}
                  className="border-b border-[color:var(--cream)]/10 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0"
                >
                  {href ? (
                    <a
                      href={href}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noopener noreferrer" : undefined}
                    >
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
            <span
              aria-hidden="true"
              className="h-px w-8 bg-current transition-all duration-500 group-hover:w-12"
            />
          </button>
        </Reveal>
      </div>
    </section>
  );
}
