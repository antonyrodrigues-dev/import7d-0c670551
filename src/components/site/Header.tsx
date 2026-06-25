import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Menu, X, Bookmark } from "lucide-react";
import { useReserva } from "@/store/reserva";

function NavLink({ href, label, dark }: { href: string; label: string; dark: boolean }) {
  return (
    <a
      href={href}
      className={`group relative inline-block py-2 text-[11px] tracking-luxe uppercase transition-all duration-300 ${
        dark ? "text-[color:var(--forest-deep)]" : "text-[color:var(--cream)]"
      }`}
      style={{ opacity: 0.85 }}
    >
      <span className="relative inline-block transition-transform duration-300 group-hover:-translate-y-[2px] group-hover:opacity-100">
        {label}
      </span>
      <span
        aria-hidden="true"
        className="absolute left-0 -bottom-0.5 h-px w-0 bg-[color:var(--gold)] transition-[width] duration-[250ms] ease-out group-hover:w-full"
      />
    </a>
  );
}

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { items, setOpen, setSearchOpen } = useReserva();
  const count = items.reduce((a, i) => a + i.quantity, 0);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (count > 0) setPulse((p) => p + 1);
  }, [count]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-[600ms] ease-out ${
        scrolled ? "bg-[color:var(--cream)]/94 backdrop-blur-[6px]" : "bg-transparent"
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

        <a
          href="#top"
          aria-label="7D Imports — início"
          className={`flex items-baseline gap-2 transition-colors duration-500 ${
            scrolled ? "text-[color:var(--forest-deep)]" : "text-[color:var(--cream)]"
          }`}
        >
          <span className="font-display text-2xl md:text-[28px] leading-none font-medium tracking-logo">7D</span>
          <span className="hidden sm:inline text-[9px] tracking-[0.42em] uppercase opacity-70 -translate-y-[2px]">
            Imports
          </span>
        </a>

        <nav aria-label="Principal" className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-10">
          <NavLink href="#acervo" label="Acervo" dark={scrolled} />
          <NavLink href="#manifesto" label="Manifesto" dark={scrolled} />
          <NavLink href="#atendimento" label="Atendimento" dark={scrolled} />
        </nav>

        <div className="flex items-center justify-end gap-1 md:gap-2">
          <button
            aria-label="Buscar peças"
            onClick={() => setSearchOpen(true)}
            className={`flex h-11 w-11 items-center justify-center transition-colors ${scrolled ? "text-[color:var(--forest-deep)]" : "text-[color:var(--cream)]"}`}
          >
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <motion.button
            onClick={() => setOpen(true)}
            aria-label={`Sua reserva, ${count} ${count === 1 ? "peça" : "peças"}`}
            className={`group flex h-11 items-center gap-2 px-3 text-[11px] tracking-luxe uppercase transition-colors ${scrolled ? "text-[color:var(--forest-deep)]" : "text-[color:var(--cream)]"}`}
          >
            <motion.span
              key={pulse}
              animate={pulse > 0 ? { scale: [1, 1.08, 1] } : {}}
              transition={{ type: "spring", stiffness: 420, damping: 14 }}
              className="inline-flex"
            >
              <Bookmark className="h-[18px] w-[18px]" strokeWidth={1.4} aria-hidden="true" />
            </motion.span>
            <span className="hidden sm:inline">Reserva</span>
            <AnimatePresence mode="popLayout">
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 18 }}
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--gold)] px-1.5 text-[10px] tabular-nums text-[color:var(--forest-deep)]"
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[color:var(--gold)]/60 transition-opacity duration-[600ms] ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
      />

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-[color:var(--forest-deep)] text-[color:var(--cream)] md:hidden" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between px-5 h-16">
            <span className="font-display text-2xl tracking-logo font-medium">7D</span>
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