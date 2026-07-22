import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { X, Minus, Plus } from "lucide-react";
import { formatBRL, type PublicProduct } from "@/features/catalog";
import { useReserva } from "@/store/reserva";
import { track } from "@/lib/analytics";

interface Props {
  product: PublicProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_QTY = 10;

export function ProductSheet({ product, open, onOpenChange }: Props) {
  const [size, setSize] = useState<string>(product.sizes[0]);
  const [qty, setQty] = useState(1);
  const addItem = useReserva((s) => s.addItem);
  const addingRef = useRef(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Reset qty when the sheet closes so reopening starts fresh.
  useEffect(() => {
    if (!open) {
      setQty(1);
      addingRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    // Robust scroll lock — preserves scroll position and works on iOS Safari
    // (where overflow:hidden on body alone still allows touch scroll).
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    // Initial focus into the dialog (close button is the safest anchor).
    requestAnimationFrame(() => closeRef.current?.focus());

    const getFocusable = () => {
      const root = dialogRef.current;
      if (!root) return [] as HTMLElement[];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = getFocusable();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
      document.removeEventListener("keydown", onKey);
      // Restore focus to the trigger that opened the dialog.
      const t = returnFocusRef.current;
      if (t && document.contains(t)) requestAnimationFrame(() => t.focus());
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
            ref={(el) => {
              dialogRef.current = el;
            }}
            data-testid="product-sheet"
            className="fixed inset-x-0 bottom-0 z-50 flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[color:var(--cream)] text-[color:var(--ink)] shadow-2xl lg:h-[90dvh] lg:max-h-[90dvh]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 32, mass: 0.9 }}
          >
            <div className="relative flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-2 lg:overflow-hidden">
              <button
                onClick={() => onOpenChange(false)}
                aria-label="Fechar"
                ref={closeRef}
                data-testid="product-close"
                className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center bg-[color:var(--cream)]/95 text-[color:var(--forest-deep)] shadow"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="h-[38dvh] w-full shrink-0 bg-[color:var(--cream-deep)] sm:h-[42dvh] lg:h-full lg:min-h-0">
                <img
                  src={product.image}
                  alt={product.name}
                  width={896}
                  height={1152}
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="relative flex min-h-0 flex-1 flex-col lg:overflow-hidden">
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-6 pb-6 lg:px-12 lg:pt-12">
                  <div className="flex flex-col gap-6">
                <div>
                  <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                    {product.category}
                  </p>
                  <h2 className="mt-2 font-display text-3xl md:text-4xl text-[color:var(--forest-deep)]">
                    {product.name}
                  </h2>
                  <p className="mt-4 font-display text-2xl tabular-nums text-[color:var(--forest-deep)]">
                    {formatBRL(product.price)}
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-[color:var(--muted-foreground)]">
                  {product.description}
                </p>

                <fieldset className="border-0 p-0">
                  <legend className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                    Tamanho
                  </legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.sizes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        aria-pressed={size === s}
                        data-testid={`size-${s}`}
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
                  <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                    Quantidade
                  </span>
                  <div className="ml-2 flex items-center border border-[color:var(--border)]">
                    <button
                      aria-label="Diminuir"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      data-testid="product-qty-dec"
                      className="flex h-11 w-11 items-center justify-center"
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span
                      aria-live="polite"
                      data-testid="product-qty-value"
                      className="min-w-8 text-center tabular-nums"
                    >
                      {qty}
                    </span>
                    <button
                      aria-label="Aumentar"
                      onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
                      data-testid="product-qty-inc"
                      className="flex h-11 w-11 items-center justify-center"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                  </div>
                </div>

                <div className="shrink-0 border-t border-[color:var(--border)]/60 bg-[color:var(--cream)] px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:px-12 lg:py-6">
                  <button
                  onClick={() => {
                    if (addingRef.current) return;
                    addingRef.current = true;
                    addItem(product, size, qty);
                    track({
                      name: "reserve_add",
                      slug: product.slug,
                      size,
                      quantity: qty,
                      price: product.price,
                    });
                    onOpenChange(false);
                  }}
                  data-testid="product-add"
                  className="inline-flex h-14 w-full items-center justify-center bg-[color:var(--forest-deep)] text-[11px] tracking-luxe uppercase text-[color:var(--cream)] transition-colors duration-300 hover:bg-[color:var(--forest)] active:scale-[0.98]"
                >
                  Adicionar à reserva
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
