import { AnimatePresence, motion } from "framer-motion";
import { X, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useReserva } from "@/store/reserva";
import { formatBRL } from "@/data/products";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function ReservaDrawer() {
  const { open, items, setOpen, removeItem, updateQty } = useReserva();
  const total = items.reduce((a, i) => a + i.price * i.quantity, 0);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-[color:var(--forest-deep)]/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} aria-hidden="true" />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Sua reserva"
            className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-md flex-col bg-[color:var(--cream)] text-[color:var(--ink)] shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-6 py-5">
              <div>
                <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">Sua seleção</p>
                <h2 className="mt-1 font-display text-2xl text-[color:var(--forest-deep)]">Reserva</h2>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fechar reserva" className="flex h-11 w-11 items-center justify-center text-[color:var(--forest-deep)]">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {items.length === 0 ? (
                <p className="mt-8 text-center font-display text-lg italic text-[color:var(--muted-foreground)]">
                  Sua reserva aguarda a primeira peça.
                </p>
              ) : (
                <ul className="flex flex-col gap-6">
                  {items.map((i) => (
                    <li key={`${i.slug}-${i.size}`} className="grid grid-cols-[88px_minmax(0,1fr)_auto] gap-4">
                      <img src={i.image} alt={i.name} width={176} height={224} loading="lazy" className="aspect-[3/4] h-full w-full object-cover" />
                      <div className="min-w-0">
                        <p className="font-display text-base text-[color:var(--forest-deep)] truncate">{i.name}</p>
                        <p className="mt-1 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">Tam. {i.size}</p>
                        <div className="mt-2 inline-flex items-center border border-[color:var(--border)]">
                          <button aria-label="Diminuir" onClick={() => updateQty(i.slug, i.size, i.quantity - 1)} className="flex h-8 w-8 items-center justify-center">−</button>
                          <span className="min-w-6 text-center text-sm tabular-nums">{i.quantity}</span>
                          <button aria-label="Aumentar" onClick={() => updateQty(i.slug, i.size, i.quantity + 1)} className="flex h-8 w-8 items-center justify-center">+</button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <span className="font-display tabular-nums text-[color:var(--forest-deep)]">{formatBRL(i.price * i.quantity)}</span>
                        <button aria-label={`Remover ${i.name}`} onClick={() => removeItem(i.slug, i.size)} className="flex h-9 w-9 items-center justify-center text-[color:var(--muted-foreground)] hover:text-[color:var(--forest-deep)]">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-[color:var(--border)] p-6">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">Total estimado</span>
                <span className="font-display text-2xl tabular-nums text-[color:var(--forest-deep)]">{formatBRL(total)}</span>
              </div>
              <a
                href={items.length ? buildWhatsAppUrl(items) : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={items.length === 0}
                onClick={(e) => items.length === 0 && e.preventDefault()}
                className={`mt-5 inline-flex h-14 w-full items-center justify-center text-[11px] tracking-luxe uppercase transition-colors ${
                  items.length === 0
                    ? "bg-[color:var(--cream-deep)] text-[color:var(--muted-foreground)] cursor-not-allowed"
                    : "bg-[color:var(--forest-deep)] text-[color:var(--cream)] hover:bg-[color:var(--forest)]"
                }`}
              >
                Finalizar via WhatsApp
              </a>
              <p className="mt-3 text-center text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Atendimento privado · seg–sáb
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}