import { motion } from "framer-motion";
import heroVideo from "@/assets/hero-video.asset.json";
import heroPoster from "@/assets/hero-poster.asset.json";

export function Hero() {
  return (
    <section id="top" className="relative h-dvh w-full overflow-hidden bg-[color:var(--cream)]">
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-30"
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

      <div aria-hidden="true" className="absolute inset-0 bg-[color:var(--cream)]/70" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="font-display font-bold leading-none"
          style={{
            color: "#102B27",
            fontSize: "clamp(90px, 12vw, 180px)",
            letterSpacing: "-0.08em",
          }}
        >
          7D
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 max-w-4xl font-display"
          style={{
            color: "#102B27",
            fontWeight: 600,
            fontSize: "clamp(42px, 4vw, 80px)",
            letterSpacing: "0.02em",
            lineHeight: 0.95,
          }}
        >
            NÃO VENDEMOS PEÇAS.<br />CURAMOS PRESENÇA.
        </motion.h1>

        <motion.a
          href="#acervo"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="group mt-14 inline-flex items-center gap-3 px-10 py-4 text-[11px] tracking-luxe uppercase transition-colors"
          style={{
            border: "1px solid #102B27",
            color: "#102B27",
            transitionDuration: "350ms",
            transitionTimingFunction: "ease-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#102B27";
            e.currentTarget.style.color = "#F4EFE6";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#102B27";
          }}
        >
          Explorar acervo
        </motion.a>
      </div>
    </section>
  );
}