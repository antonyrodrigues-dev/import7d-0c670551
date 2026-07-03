import { BRAND } from "@/config/attendants";

const COLS = [
  {
    title: "Marca",
    links: [
      ["Manifesto", "/#manifesto"],
      ["Atendimento", "/#atendimento"],
    ],
  },
  {
    title: "Acervo",
    links: [
      ["Coleção atual", "/#acervo"],
      ["Destaques", "/#acervo"],
    ],
  },
  {
    title: "Suporte",
    links: [
      ["WhatsApp", "/#atendimento"],
      ["Entrega", "/#atendimento"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacidade", "/privacidade"],
      ["Termos", "/termos"],
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[color:var(--cream)] pt-20 pb-14 text-[color:var(--forest-deep)]">
      {/* Fio dourado no topo + halo sutil */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[color:var(--gold)]/45"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--gold)_10%,transparent)_0%,transparent_70%)]"
      />
      <div className="relative mx-auto grid max-w-[1280px] gap-14 px-6 md:grid-cols-[1.7fr_1fr_1fr_1fr_1fr] md:gap-16 md:px-12">
        <div>
          <a
            href="#top"
            aria-label="7D Imports — voltar ao topo"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="font-display leading-none text-[color:var(--forest-deep)] flex items-baseline gap-3 transition-opacity duration-300 hover:opacity-80 focus-visible:opacity-80"
          >
            <span style={{ fontSize: "34px", letterSpacing: "-0.07em", fontWeight: 500 }}>7D</span>
            <span
              className="text-[color:var(--forest-deep)]/75"
              style={{
                fontSize: "11px",
                letterSpacing: "0.44em",
                fontWeight: 500,
                textTransform: "uppercase",
              }}
            >
              Imports
            </span>
          </a>
          <p className="mt-6 max-w-xs font-display italic text-[15px] leading-[1.65] text-[color:var(--muted-foreground)]">
            Acervo privado de peças selecionadas. Curadoria humana, atendimento personalizado.
          </p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">
              {c.title}
            </p>
            <ul className="mt-6 space-y-4">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    className="group relative inline-block text-sm text-[color:var(--forest-deep)]/85 transition-colors duration-300 hover:text-[color:var(--forest-deep)]"
                  >
                    {label}
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-[color:var(--gold)]/70 transition-transform duration-500 group-hover:scale-x-100"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="relative mx-auto mt-16 max-w-[1280px] px-6 md:px-12">
        <div aria-hidden="true" className="h-px bg-[color:var(--gold)]/30" />
        <div className="mt-6 flex flex-col items-start justify-between gap-2 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)] md:flex-row md:items-center">
          <p>
            © {new Date().getFullYear()} {BRAND.name} · Todos os direitos reservados
          </p>
          <p className="text-[color:var(--forest-deep)]/60">Curadoria · Caxias do Sul · Brasil</p>
        </div>
      </div>
    </footer>
  );
}
