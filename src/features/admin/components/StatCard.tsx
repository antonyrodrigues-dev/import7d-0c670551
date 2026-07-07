import type { ReactNode } from "react";
import { Skeleton } from "./PageHeader";

export function StatCard({
  label,
  value,
  hint,
  icon,
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border border-[color:var(--border)] bg-[color:var(--cream)] p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          {label}
        </p>
        {icon && <span className="text-[color:var(--gold)]">{icon}</span>}
      </div>
      <p className="font-display text-3xl tabular-nums text-[color:var(--forest-deep)]">
        {loading ? <Skeleton className="h-8 w-24" /> : value}
      </p>
      {hint && (
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          {hint}
        </p>
      )}
    </div>
  );
}