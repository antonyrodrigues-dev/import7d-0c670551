import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Skeleton } from "./PageHeader";

/**
 * Card padrão para métricas do painel. Fonte única — nenhuma página cria
 * variantes próprias. Estrutura: ícone · rótulo · valor · tendência · descrição.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  loading,
  trend,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  loading?: boolean;
  trend?: {
    direction: "up" | "down" | "flat";
    label: string;
  };
}) {
  const TrendIcon =
    trend?.direction === "up" ? ArrowUp : trend?.direction === "down" ? ArrowDown : Minus;
  const trendClass =
    trend?.direction === "up"
      ? "text-[color:var(--forest-deep)]"
      : trend?.direction === "down"
        ? "text-[color:var(--destructive)]"
        : "text-[color:var(--muted-foreground)]";
  return (
    <div className="flex h-full flex-col gap-3 border border-[color:var(--border)] bg-[color:var(--cream)] p-5 transition-colors">
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          {label}
        </p>
        {icon && <span className="text-[color:var(--gold)]">{icon}</span>}
      </div>
      <p className="font-display text-3xl tabular-nums text-[color:var(--forest-deep)]">
        {loading ? <Skeleton className="h-8 w-24" /> : value}
      </p>
      {trend && !loading && (
        <p
          className={`flex items-center gap-1 text-[11px] font-medium tabular-nums ${trendClass}`}
        >
          <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{trend.label}</span>
        </p>
      )}
      {hint && (
        <p className="mt-auto text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          {hint}
        </p>
      )}
    </div>
  );
}