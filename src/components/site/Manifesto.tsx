import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import manifestoBg from "@/assets/manifesto-bg.asset.json";
import { Reveal } from "./Reveal";

const WORDS: { text: string; accent?: boolean }[] = [
  { text: "NÃO" },
  { text: "VENDEMOS" },
  { text: "PEÇAS." },
  { text: "CURAMOS" },
  { text: "PRESENÇA.", accent: true },
];

export function Manifesto() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-3%", "3%"]);
  return (
    <section
      ref={ref}
      id="manifesto"
      className="relative overflow-hidden bg-[color:var(--forest-deep)] py-28 md:py-40 text-[color:var(--cream)]"
    >
      <motion.img
        style={{ y }}
        src={manifestoBg.url}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="absolute inset-0 h-[110%] w-full object-cover opacity-50 will-change-transform"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-[color:var(--forest-deep)] via-[color:var(--forest-deep)]/78 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[color:var(--gold)]/35"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[color:var(--gold)]/35"
      />

      <div className="relative mx-auto grid max-w-[1280px] gap-16 px-6 md:grid-cols-[1.1fr_0.9fr] md:gap-24 md:px-12">
        <div>
          <Reveal
            as="span"
            className="inline-flex items-center gap-3 text-[10px] tracking-luxe uppercase text-[color:var(--gold)]/90"
          >
            <span aria-hidden="true" className="h-px w-8 bg-[color:var(--gold)]/60" />
            Manifesto
          </Reveal>
          <h2 className="mt-8 font-display text-[clamp(2.15rem,5.2vw,4rem)] leading-[1.02] tracking-tight text-[color:var(--cream)]">
            {WORDS.map((w, i) => (
              <motion.span
                key={`${w.text}-${i}`}
                initial={{ opacity: 0, y: reduce ? 0 : 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.9, delay: 0.15 * i, ease: [0.22, 1, 0.36, 1] }}
                className={`mr-[0.3em] inline-block transition-colors duration-500 ${
                  w.accent ? "cursor-default hover:text-[color:var(--gold)]" : ""
                }`}
              >
                {w.text}
              </motion.span>
            ))}
          </h2>
        </div>

        <Reveal
          delay={0.3}
          className="space-y-7 self-end font-display text-lg md:text-xl italic leading-[1.7] text-[color:var(--cream)]/92"
        >
          <p>
            Cada peça que entra no acervo passa por um filtro humano — tecido, corte, origem,
            <span className="cursor-default not-italic transition-colors duration-500 hover:text-[color:var(--gold)]">
              {" "}
              assinatura
            </span>
            . Recusamos volume. Honramos a
            <span className="cursor-default not-italic transition-colors duration-500 hover:text-[color:var(--gold)]">
              {" "}
              escolha
            </span>
            .
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
