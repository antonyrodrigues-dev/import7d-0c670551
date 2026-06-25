import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "header" | "p" | "h1" | "h2" | "h3" | "span";
}

export function Reveal({ children, delay = 0, y = 20, className, as = "div" }: RevealProps) {
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    show: { opacity: 1, y: 0, transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] } },
  };
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} variants={variants} className={className}>
      {children}
    </MotionTag>
  );
}