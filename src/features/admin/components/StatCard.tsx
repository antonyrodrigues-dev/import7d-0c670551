import { memo, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Skeleton } from "./PageHeader";

/**
 * Card padrão para métricas do painel. Fonte única — nenhuma página cria
 * variantes próprias. Estrutura: ícone · rótulo · valor · tendência · descrição.
 * Quando `onClick` é fornecido, o card passa a ser um `button` navegável
 * (drill-down a partir do dashboard).
 *
 * `memo` — dashboard renderiza 11 cards; sem memo cada re-render do container
 * dispara todos. Props são primitivos/nodes estáveis, então a igualdade shallow
 * padrão do memo é suficiente.
 */
function StatCardImpl({
  label,
  value,
  hint,
  icon,
  loading,
  trend,
  onClick,
  ariaLabel,
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
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const TrendIcon =
    trend?.direction === "up" ? ArrowUp : trend?.direction === "down" ? ArrowDown : Minus;
  const trendClass =
    trend?.direction === "up"
      ? "text-[color:var(--forest-deep)]"
      : trend?.direction === "down"
        ? "text-[color:var(--destructive)]"
        : "text-[color:var(--muted-foreground)]";
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          {label}
        </p>
        {icon && <span className="text-[color:var(--gold)]">{icon}</span>}
      </div>
      <div className="font-display text-3xl tabular-nums text-[color:var(--forest-deep)]">
        {loading ? <Skeleton className="h-8 w-24" /> : value}
      </div>
      {trend && !loading && (
        <p className={`flex items-center gap-1 text-[11px] font-medium tabular-nums ${trendClass}`}>
          <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{trend.label}</span>
        </p>
      )}
      {hint && (
        <p className="mt-auto text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          {hint}
        </p>
      )}
    </>
  );
  const base =
    "flex h-full flex-col gap-3 border border-[color:var(--border)] bg-[color:var(--cream)] p-5 text-left transition-colors";
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? label}
        className={`${base} hover:border-[color:var(--forest-deep)] hover:bg-[color:var(--cream-deep)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]`}
      >
        {body}
      </button>
    );
  }
  return <div className={base}>{body}</div>;
}

export const StatCard = memo(StatCardImpl);
