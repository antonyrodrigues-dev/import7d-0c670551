import { BRAND } from "@/config/attendants";

const COLS = [
  { title: "Marca", links: [["Manifesto", "/#manifesto"], ["Atendimento", "/#atendimento"]] },
  { title: "Acervo", links: [["Coleção atual", "/#acervo"], ["Destaques", "/#acervo"]] },
  { title: "Suporte", links: [["WhatsApp", "/#atendimento"], ["Entrega", "/#atendimento"]] },
  { title: "Legal", links: [["Privacidade", "/privacidade"], ["Termos", "/termos"]] },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-[color:var(--border)] bg-[color:var(--cream)] py-16 text-[color:var(--forest-deep)]">
      <div className="mx-auto grid max-w-[1280px] gap-14 px-6 md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr] md:gap-16 md:px-12">
        <div>
          <p
            className="font-display leading-none text-[color:var(--forest-deep)] flex items-baseline gap-3"
            aria-label="7D Imports"
          >
            <span style={{ fontSize: "32px", letterSpacing: "-0.07em", fontWeight: 500 }}>7D</span>
            <span
              className="text-[color:var(--forest-deep)]/70"
              style={{ fontSize: "11px", letterSpacing: "0.42em", fontWeight: 500, textTransform: "uppercase" }}
            >
              Imports
            </span>
          </p>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-[color:var(--muted-foreground)]">
            Acervo privado de peças selecionadas. Curadoria humana, atendimento personalizado.
          </p>
          <div className="mt-8 flex items-center gap-3 text-[10px] tracking-luxe uppercase text-[color:var(--forest-deep)]/55">
            <span aria-hidden="true" className="h-px w-8 bg-[color:var(--gold)]/60" />
            Est. MMXXVI
          </div>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">{c.title}</p>
            <ul className="mt-6 space-y-4">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="group relative inline-block text-sm text-[color:var(--forest-deep)]/85 transition-colors duration-300 hover:text-[color:var(--forest-deep)]">
                    {label}
                    <span aria-hidden="true" className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-[color:var(--gold)]/70 transition-transform duration-500 group-hover:scale-x-100" />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-16 max-w-[1280px] px-6 md:px-12">
        <div aria-hidden="true" className="h-px bg-[color:var(--gold)]/25" />
        <div className="mt-6 flex flex-col items-start justify-between gap-2 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)] md:flex-row">
          <p>© {new Date().getFullYear()} {BRAND.name} · Todos os direitos reservados</p>
          <p>Caxias do Sul · Brasil</p>
        </div>
      </div>
    </footer>
  );
}