import { useEffect, useState } from "react";
import { Search, Menu, X } from "lucide-react";
import { useReserva } from "@/store/reserva";
import { BRAND } from "@/config/attendants";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { items, setOpen, setSearchOpen } = useReserva();
  const count = items.reduce((a, i) => a + i.quantity, 0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-700 ease-out ${
        scrolled ? "bg-[color:var(--cream)]/92 backdrop-blur-[6px] border-b border-[color:var(--border)]/60" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 md:h-[72px] max-w-[1440px] items-center justify-between px-5 md:px-10">
        <button
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className={`flex h-11 w-11 items-center justify-center md:hidden ${scrolled ? "text-[color:var(--forest-deep)]" : "text-[color:var(--cream)]"}`}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <nav aria-label="Principal" className="hidden md:flex flex-1 items-center gap-10">
          <a href="#acervo" className={`text-[11px] tracking-luxe uppercase transition-opacity hover:opacity-100 ${scrolled ? "text-[color:var(--forest-deep)] opacity-80" : "text-[color:var(--cream)] opacity-90"}`}>Acervo</a>
          <a href="#manifesto" className={`text-[11px] tracking-luxe uppercase transition-opacity hover:opacity-100 ${scrolled ? "text-[color:var(--forest-deep)] opacity-80" : "text-[color:var(--cream)] opacity-90"}`}>Manifesto</a>
          <a href="#atendimento" className={`text-[11px] tracking-luxe uppercase transition-opacity hover:opacity-100 ${scrolled ? "text-[color:var(--forest-deep)] opacity-80" : "text-[color:var(--cream)] opacity-90"}`}>Atendimento</a>
        </nav>

        <a href="#top" className={`absolute left-1/2 -translate-x-1/2 font-display text-lg md:text-xl tracking-[0.32em] transition-colors duration-500 ${scrolled ? "text-[color:var(--forest-deep)]" : "text-[color:var(--cream)]"}`}>
          {BRAND.name}
        </a>

        <div className="flex flex-1 items-center justify-end gap-1 md:gap-2">
          <button
            aria-label="Buscar peças"
            onClick={() => setSearchOpen(true)}
            className={`flex h-11 w-11 items-center justify-center transition-colors ${scrolled ? "text-[color:var(--forest-deep)]" : "text-[color:var(--cream)]"}`}
          >
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <button
            onClick={() => setOpen(true)}
            aria-label={`Sua reserva, ${count} ${count === 1 ? "peça" : "peças"}`}
            className={`flex h-11 min-w-11 items-center justify-center gap-2 px-3 text-[11px] tracking-luxe uppercase transition-colors ${scrolled ? "text-[color:var(--forest-deep)]" : "text-[color:var(--cream)]"}`}
          >
            <span className="hidden sm:inline">Reserva</span>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-current px-1.5 text-[10px] tabular-nums">{count}</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-[color:var(--forest-deep)] text-[color:var(--cream)] md:hidden" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between px-5 h-16">
            <span className="font-display text-lg tracking-[0.32em]">{BRAND.name}</span>
            <button aria-label="Fechar menu" onClick={() => setMenuOpen(false)} className="flex h-11 w-11 items-center justify-center">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Menu" className="flex flex-col gap-6 px-8 pt-14">
            {[["Acervo","#acervo"],["Manifesto","#manifesto"],["Atendimento","#atendimento"]].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)} className="font-display text-3xl tracking-wide">
                {label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}