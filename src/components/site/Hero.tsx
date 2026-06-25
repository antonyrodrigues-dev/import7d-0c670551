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
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[color:var(--forest-deep)]/75 via-[color:var(--forest-deep)]/35 to-transparent" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[color:var(--forest-deep)]/45 to-transparent" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center text-[color:var(--cream)]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-baseline gap-3 font-display"
        >
          <span className="text-[clamp(3rem,10vw,7rem)] leading-[0.9] tracking-logo font-medium">7D</span>
          <span className="text-[11px] tracking-[0.42em] uppercase opacity-80 -translate-y-2">Imports</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 max-w-3xl font-display text-[clamp(1.75rem,4.2vw,3rem)] leading-[1.05] text-[color:var(--cream)]"
        >
          Não vendemos peças.<br/>Curamos presença.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-md text-[11px] tracking-luxe uppercase text-[color:var(--cream)]/85"
        >
          Curadoria privada · Entrega Brasil
        </motion.p>

        <motion.a
          href="#acervo"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
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