/**
 * 7D IMPORTS — Badge de tom operacional compartilhado.
 *
 * Usado por Pedidos e Atendimentos para exibir status, pagamento e
 * prioridade com a mesma linguagem visual. Tons derivam sempre de
 * `orderView.ts` (ou de props explícitas) — nunca de cor hardcoded.
 */

import type { ReactNode } from "react";
import type { BadgeTone } from "../lib/orderView";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral:
    "border-[color:var(--border)] bg-[color:var(--cream-deep)]/40 text-[color:var(--muted-foreground)]",
  info: "border-[color:var(--forest-deep)]/30 bg-[color:var(--forest-deep)]/10 text-[color:var(--forest-deep)]",
  warn: "border-amber-300 bg-amber-50 text-amber-800",
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
  danger: "border-red-300 bg-red-50 text-red-700",
};

export function StatusBadge({
  tone,
  children,
  icon,
}: {
  tone: BadgeTone;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap border px-2 py-1 text-[10px] tracking-luxe uppercase ${TONE_CLASS[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}
