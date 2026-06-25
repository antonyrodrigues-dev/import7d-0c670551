import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { X, Minus, Plus } from "lucide-react";
import { formatBRL, type Product } from "@/data/products";
import { useReserva } from "@/store/reserva";

interface Props {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductSheet({ product, open, onOpenChange }: Props) {
  const [size, setSize] = useState<string>(product.sizes[0]);
  const [qty, setQty] = useState(1);
  const addItem = useReserva((s) => s.addItem);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-[color:var(--forest-deep)]/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onClick={() => onOpenChange(false)}
            aria-hidden="true"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`Detalhes — ${product.name}`}
            className="fixed inset-x-0 bottom-0 z-50 h-[85dvh] overflow-hidden rounded-t-3xl bg-[color:var(--cream)] text-[color:var(--ink)] shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 32, mass: 0.9 }}
          >
            <div className="flex h-full flex-col overflow-y-auto md:grid md:grid-cols-2 md:overflow-hidden">
              <button
                onClick={() => onOpenChange(false)}
                aria-label="Fechar"
                className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--cream)]/90 text-[color:var(--forest-deep)] shadow"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="aspect-[3/4] w-full bg-[color:var(--cream-deep)] md:aspect-auto md:h-full">
                <img src={product.image} alt={product.name} width={896} height={1152} className="h-full w-full object-contain" />
              </div>

              <div className="flex flex-1 flex-col gap-6 p-6 md:overflow-y-auto md:p-12">
                <div>
                  <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">{product.category}</p>
                  <h2 className="mt-2 font-display text-3xl md:text-4xl text-[color:var(--forest-deep)]">{product.name}</h2>
                  <p className="mt-4 font-display text-2xl tabular-nums text-[color:var(--forest-deep)]">{formatBRL(product.price)}</p>
                </div>
                <p className="text-sm leading-relaxed text-[color:var(--muted-foreground)]">{product.description}</p>

                <fieldset className="border-0 p-0">
                  <legend className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">Tamanho</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.sizes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        aria-pressed={size === s}
                        className={`min-h-11 min-w-11 border px-4 text-sm tracking-wider transition-colors ${
                          size === s
                            ? "border-[color:var(--forest-deep)] bg-[color:var(--forest-deep)] text-[color:var(--cream)]"
                            : "border-[color:var(--border)] text-[color:var(--forest-deep)] hover:border-[color:var(--forest-deep)]"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">Quantidade</span>
                  <div className="ml-2 flex items-center border border-[color:var(--border)]">
                    <button aria-label="Diminuir" onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-11 w-11 items-center justify-center"><Minus className="h-4 w-4" aria-hidden="true" /></button>
                    <span aria-live="polite" className="min-w-8 text-center tabular-nums">{qty}</span>
                    <button aria-label="Aumentar" onClick={() => setQty((q) => q + 1)} className="flex h-11 w-11 items-center justify-center"><Plus className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    addItem(product, size, qty);
                    onOpenChange(false);
                  }}
                  className="mt-auto inline-flex h-14 items-center justify-center bg-[color:var(--forest-deep)] text-[11px] tracking-luxe uppercase text-[color:var(--cream)] transition-transform hover:bg-[color:var(--forest)] active:scale-[0.99]"
                >
                  Adicionar à reserva
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}