import { motion } from "framer-motion";
import heroVideo from "@/assets/hero-video.asset.json";
import heroPoster from "@/assets/hero-poster.asset.json";

export function Hero() {
  return (
    <section id="top" className="relative h-dvh w-full overflow-hidden bg-[color:var(--forest-deep)]">
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

      <div aria-hidden="true" className="absolute inset-0 bg-[color:var(--forest-deep)]/[0.18]" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-[color:var(--forest-deep)]/30 via-transparent to-[color:var(--forest-deep)]/40" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center text-[color:var(--cream)]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-[clamp(2.5rem,8vw,5.5rem)] leading-[0.95] tracking-[0.18em]"
        >
          7D&nbsp;IMPORTS
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-2xl text-[11px] tracking-luxe uppercase text-[color:var(--cream)]/90"
        >
          Acesso a peças selecionadas
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 max-w-md font-display text-lg md:text-xl italic text-[color:var(--cream)]/85"
        >
          Curadoria premium. Atendimento personalizado. Entrega para todo o Brasil.
        </motion.p>

        <motion.a
          href="#acervo"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="group mt-12 inline-flex items-center gap-3 border border-[color:var(--cream)]/70 px-8 py-4 text-[11px] tracking-luxe uppercase text-[color:var(--cream)] transition-all duration-500 hover:bg-[color:var(--cream)] hover:text-[color:var(--forest-deep)] active:scale-[0.98]"
          style={{ willChange: "transform" }}
        >
          <span className="transition-transform duration-500 group-hover:translate-x-0.5">Explorar acervo</span>
          <span aria-hidden="true" className="h-px w-8 bg-current transition-all duration-500 group-hover:w-12" />
        </motion.a>
      </div>

      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] tracking-luxe uppercase text-[color:var(--cream)]/70"
      >
        Role para descobrir
      </motion.div>
    </section>
  );
}