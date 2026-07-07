import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Menu, X, Bookmark } from "lucide-react";
import { useReserva } from "@/store/reserva";

function NavLink({ href, label, scrolled }: { href: string; label: string; scrolled: boolean }) {
  return (
    <a
      href={href}
      className={`group relative inline-block py-2 text-[11px] tracking-luxe uppercase transition-colors duration-300 ${
        scrolled
          ? "text-[color:var(--forest-deep)]/80 hover:text-[color:var(--forest-deep)]"
          : "text-[color:var(--cream)]/85 hover:text-[color:var(--cream)]"
      }`}
    >
      <span className="relative inline-block">{label}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-0.5 left-1/2 h-px w-0 -translate-x-1/2 bg-[color:var(--gold)]/70 transition-[width] duration-[450ms] ease-out group-hover:w-[60%]"
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

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-[background-color,backdrop-filter] duration-[600ms] ease-out ${
        scrolled ? "bg-[color:var(--cream)]/94 backdrop-blur-[6px]" : "bg-transparent"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div
        className={`mx-auto flex h-16 md:h-[72px] max-w-[1440px] items-center justify-between px-5 md:px-10 transition-colors duration-[600ms] ease-out ${
          scrolled ? "text-[color:var(--forest-deep)]" : "text-[color:var(--cream)]"
        }`}
      >
        <button
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className="flex h-11 w-11 items-center justify-center md:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <a
          href="#top"
          aria-label="7D Imports — início"
          className="group font-display leading-none flex items-baseline gap-2.5"
        >
          <span style={{ fontSize: "26px", letterSpacing: "-0.07em", fontWeight: 500 }}>7D</span>
          <span
            className={`hidden sm:inline transition-opacity duration-500 ${
              scrolled ? "opacity-70" : "opacity-80"
            }`}
            style={{
              fontSize: "10px",
              letterSpacing: "0.42em",
              fontWeight: 500,
              textTransform: "uppercase",
            }}
          >
            Imports
          </span>
        </a>

        <nav
          aria-label="Principal"
          className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-8 lg:gap-12"
        >
          <NavLink href="#acervo" label="Acervo" scrolled={scrolled} />
          <NavLink href="#manifesto" label="Manifesto" scrolled={scrolled} />
          <NavLink href="#atendimento" label="Atendimento" scrolled={scrolled} />
        </nav>

        <div className="flex items-center justify-end gap-1 md:gap-2">
          <button
            aria-label="Buscar peças"
            onClick={() => setSearchOpen(true)}
            className="flex h-11 w-11 items-center justify-center"
          >
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <motion.button
            onClick={() => setOpen(true)}
            aria-label={`Sua reserva, ${count} ${count === 1 ? "peça" : "peças"}`}
            className="group flex h-11 items-center gap-2 px-3 text-[11px] tracking-luxe uppercase"
          >
            <motion.span
              key={pulse}
              animate={pulse > 0 ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex"
            >
              <Bookmark className="h-[18px] w-[18px]" strokeWidth={1.4} aria-hidden="true" />
            </motion.span>
            <span className="hidden lg:inline">Reserva</span>
            <AnimatePresence mode="popLayout">
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 44 }}
                  className="ml-1 inline-flex font-display text-[14px] font-medium tabular-nums leading-none text-[color:var(--gold)]"
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
        <div
          className="fixed inset-0 z-50 bg-[color:var(--forest-deep)] text-[color:var(--cream)] md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between px-5 h-16">
            <span className="font-display text-2xl tracking-logo font-medium">7D</span>
            <button
              aria-label="Fechar menu"
              onClick={() => setMenuOpen(false)}
              className="flex h-11 w-11 items-center justify-center"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Menu" className="flex flex-col gap-6 px-8 pt-14">
            {[
              ["Acervo", "#acervo"],
              ["Manifesto", "#manifesto"],
              ["Atendimento", "#atendimento"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="font-display text-3xl tracking-wide"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
