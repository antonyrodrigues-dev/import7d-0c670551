import { motion } from "framer-motion";
import { PRODUCTS, formatBRL, type Product } from "@/data/products";
import { useReserva } from "@/store/reserva";
import { useState } from "react";
import { ProductSheet } from "./ProductSheet";

function Card({ p }: { p: Product }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="group block w-full text-left"
        aria-label={`Ver detalhes — ${p.name}`}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-[color:var(--cream-deep)]">
          <motion.img
            src={p.image}
            alt={p.name}
            width={896}
            height={1152}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ease-out group-hover:opacity-0"
            initial={{ scale: 1 }}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ willChange: "transform" }}
          />
          <img
            src={p.imageAlt || p.image}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px scale-x-0 origin-left bg-[color:var(--gold)] transition-transform duration-500 group-hover:scale-x-100" />
        </div>
        <div className="mt-5 flex items-baseline justify-between gap-4">
          <div>
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">{p.category}</p>
            <h3 className="mt-1 font-display text-xl text-[color:var(--forest-deep)]">{p.name}</h3>
          </div>
          <span className="font-display text-base tabular-nums text-[color:var(--forest-deep)]">{formatBRL(p.price)}</span>
        </div>
      </motion.button>
      <ProductSheet product={p} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function FeaturedGrid() {
  const featured = PRODUCTS.filter((p) => p.featured);
  return (
    <div className="grid gap-12 sm:grid-cols-2 md:gap-10 lg:grid-cols-3">
      {featured.map((p) => <Card key={p.slug} p={p} />)}
    </div>
  );
}

export function FullGrid() {
  const { searchOpen } = useReserva();
  void searchOpen;
  return (
    <div className="grid gap-12 sm:grid-cols-2 md:gap-10 lg:grid-cols-3">
      {PRODUCTS.map((p) => <Card key={p.slug} p={p} />)}
    </div>
  );
}