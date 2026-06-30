import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import heroVideo from "@/assets/hero-video.asset.json";
import heroPoster from "@/assets/hero-poster.asset.json";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const reduce = useReducedMotion();
  return (
    <section
      id="top"
      className="relative h-dvh min-h-[620px] w-full overflow-hidden bg-[color:var(--cream)]"
    >
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={heroPoster.url}
        aria-hidden="true"
      >
        <source src={heroVideo.url} type="video/webm" />
      </video>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-[color:var(--cream)]/90 via-[color:var(--cream)]/40 to-transparent"
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-end px-6 pb-[clamp(64px,11vh,140px)] text-center text-[color:var(--forest-deep)] md:px-10">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center">
          <motion.p
            initial={{ opacity: 0, y: reduce ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
            className="mb-6 text-center text-[10px] tracking-luxe uppercase text-[color:var(--gold)] md:mb-8"
          >
            Acervo · Primavera 2026
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: reduce ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.32, ease: EASE }}
            className="text-center font-display font-medium"
            style={{
              fontSize: "clamp(44px, 6.4vw, 108px)",
              letterSpacing: "-0.018em",
              lineHeight: 1.04,
            }}
          >
            <span className="block">NÃO VENDEMOS PEÇAS</span>
            <span className="mt-1 block italic text-[color:var(--forest)] md:mt-2">curamos presença</span>
          </motion.h1>

          <motion.a
            href="#acervo"
            initial={{ opacity: 0, y: reduce ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7, ease: EASE }}
            className="group mt-10 inline-flex h-[56px] items-center gap-3 border border-[color:var(--forest-deep)] bg-transparent px-10 text-[12px] font-medium tracking-luxe uppercase text-[color:var(--forest-deep)] transition-all duration-[400ms] ease-out hover:bg-[color:var(--forest-deep)] hover:text-[color:var(--cream)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--cream)] md:mt-12 md:h-[60px] md:px-12"
          >
            <span>Explorar acervo</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-[400ms] ease-out group-hover:translate-x-1" aria-hidden="true" />
          </motion.a>
        </div>
      </div>
    </section>
  );
}