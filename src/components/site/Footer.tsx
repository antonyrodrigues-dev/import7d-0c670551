import { BRAND } from "@/config/attendants";

const COLS = [
  { title: "Marca", links: [["Manifesto", "#manifesto"], ["Atendimento", "#atendimento"]] },
  { title: "Acervo", links: [["Coleção atual", "#acervo"], ["Destaques", "#acervo"]] },
  { title: "Suporte", links: [["WhatsApp", "#atendimento"], ["Entrega", "#atendimento"]] },
  { title: "Legal", links: [["Privacidade", "#"], ["Termos", "#"]] },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-[color:var(--border)] bg-[color:var(--cream)] py-16 text-[color:var(--forest-deep)]">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] md:gap-16 md:px-12">
        <div>
          <p className="font-display text-2xl tracking-[0.32em]">{BRAND.name}</p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[color:var(--muted-foreground)]">
            Acervo privado de peças selecionadas. Curadoria humana, atendimento personalizado.
          </p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">{c.title}</p>
            <ul className="mt-5 space-y-3">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="group relative inline-block text-sm">
                    {label}
                    <span aria-hidden="true" className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-current transition-transform duration-500 group-hover:scale-x-100" />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-16 max-w-[1280px] px-6 md:px-12">
        <div aria-hidden="true" className="h-px bg-[color:var(--gold)]/30" />
        <p className="mt-6 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">© {new Date().getFullYear()} {BRAND.name} · Todos os direitos reservados</p>
      </div>
    </footer>
  );
}