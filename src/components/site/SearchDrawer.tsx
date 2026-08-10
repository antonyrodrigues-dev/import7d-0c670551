import { AnimatePresence, motion } from "framer-motion";
import { X, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useReserva } from "@/store/reserva";
import { formatBRL, useCatalog } from "@/features/catalog";

export function SearchDrawer() {
  const { searchOpen, setSearchOpen } = useReserva();
  const { products } = useCatalog();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!searchOpen) {
      setQ("");
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSearchOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [searchOpen, setSearchOpen]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      [p.name, p.category, p.description].some((f) => f.toLowerCase().includes(term)),
    );
  }, [q, products]);

  return (
    <AnimatePresence>
      {searchOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-[color:var(--forest-deep)]/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSearchOpen(false)}
            aria-hidden="true"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Buscar peças"
            className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-xl flex-col bg-[color:var(--cream)] text-[color:var(--ink)] shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3 border-b border-[color:var(--border)] px-5 py-4">
              <Search className="h-5 w-5 text-[color:var(--muted-foreground)]" aria-hidden="true" />
              <label htmlFor="search-input" className="sr-only">
                Buscar peças
              </label>
              <input
                id="search-input"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar peça, categoria, tecido…"
                className="h-11 flex-1 bg-transparent font-display text-xl text-[color:var(--forest-deep)] placeholder:text-[color:var(--muted-foreground)]/70 focus:outline-none"
              />
              <button
                onClick={() => setSearchOpen(false)}
                aria-label="Fechar busca"
                className="flex h-11 w-11 items-center justify-center text-[color:var(--forest-deep)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {results.length === 0 ? (
                <p className="mt-12 text-center font-display italic text-[color:var(--muted-foreground)]">
                  Nenhuma peça encontrada.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {results.map((p) => (
                    <li key={p.slug}>
                      <a
                        href={`#acervo`}
                        onClick={() => setSearchOpen(false)}
                        className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-4 border-b border-[color:var(--border)] py-3 transition-colors hover:bg-[color:var(--cream-deep)]/50"
                      >
                        <span className="relative block aspect-[3/4] w-full overflow-hidden bg-[color:var(--cream-deep)]">
                          <SafeImage
                            src={p.image}
                            alt={p.name}
                            hidden
                            width={144}
                            height={192}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="font-display text-base text-[color:var(--forest-deep)] truncate">
                            {p.name}
                          </p>
                          <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                            {p.category}
                          </p>
                        </div>
                        <span className="font-display tabular-nums text-[color:var(--forest-deep)]">
                          {formatBRL(p.price)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
