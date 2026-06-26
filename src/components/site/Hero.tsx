import { motion } from "framer-motion";
import heroVideo from "@/assets/hero-video.asset.json";
import heroPoster from "@/assets/hero-poster.asset.json";

export function Hero() {
  return (
    <section id="top" className="relative h-dvh w-full overflow-hidden bg-[color:var(--cream)]">
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-60"
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

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center text-[color:var(--forest-deep)]">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-6xl font-display"
          style={{
            fontWeight: 600,
            fontSize: "clamp(56px, 7vw, 132px)",
            letterSpacing: "0.02em",
            lineHeight: 0.92,
          }}
        >
            NÃO VENDEMOS PEÇAS.<br />CURAMOS PRESENÇA.
        </motion.h1>

        <motion.a
          href="#acervo"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14 inline-flex items-center gap-3 border border-[color:var(--forest-deep)] bg-transparent px-10 py-4 text-[11px] tracking-luxe uppercase text-[color:var(--forest-deep)] transition-colors duration-[350ms] ease-out hover:bg-[color:var(--forest-deep)] hover:text-[color:var(--cream)]"
        >
          Explorar acervo
        </motion.a>
      </div>
    </section>
  );
}