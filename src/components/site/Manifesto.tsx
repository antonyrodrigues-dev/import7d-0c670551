import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import manifestoBg from "@/assets/manifesto-bg.asset.json";
import { Reveal } from "./Reveal";

const WORDS = ["NÃO", "VENDEMOS", "PEÇAS.", "CURAMOS", "PRESENÇA."];

export function Manifesto() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-3%", "3%"]);
  return (
    <section ref={ref} id="manifesto" className="relative overflow-hidden bg-[color:var(--forest-deep)] py-28 md:py-40 text-[color:var(--cream)]">
      <motion.img
        style={{ y }}
        src={manifestoBg.url}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="absolute inset-0 h-[110%] w-full object-cover opacity-50 will-change-transform"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[color:var(--forest-deep)] via-[color:var(--forest-deep)]/70 to-transparent" />

      <div className="relative mx-auto grid max-w-[1280px] gap-16 px-6 md:grid-cols-[1.1fr_0.9fr] md:gap-24 md:px-12">
        <div>
          <Reveal as="span" className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]/90">
            Manifesto
          </Reveal>
          <h2 className="mt-6 font-display text-[clamp(2rem,5vw,3.75rem)] leading-[1.05] tracking-tight">
            {WORDS.map((w, i) => (
              <motion.span
                key={`${w}-${i}`}
                initial={{ opacity: 0, y: reduce ? 0 : 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.9, delay: 0.15 * i, ease: [0.22, 1, 0.36, 1] }}
                className="mr-[0.3em] inline-block"
              >
                {w}
              </motion.span>
            ))}
          </h2>
        </div>

        <Reveal delay={0.3} className="space-y-6 self-end font-display text-lg md:text-xl italic leading-relaxed text-[color:var(--cream)]/85">
          <p>
            Cada peça que entra no acervo passa por um filtro humano — tecido, corte, origem,
            assinatura. Recusamos volume. Honramos a escolha.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <span aria-hidden="true" className="h-px w-10 bg-[color:var(--gold)]/60" />
            <p className="not-italic font-sans text-[11px] tracking-luxe uppercase text-[color:var(--gold)]/90">
              A casa · MMXXVI
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}