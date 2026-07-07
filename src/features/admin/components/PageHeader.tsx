import type { ReactNode } from "react";

/** Cabeçalho padrão de página administrativa. */
export function PageHeader({
  eyebrow,
  title,
  actions,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6 border-b border-[color:var(--border)] pb-6">
      <div className="min-w-0">
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl md:text-4xl text-[color:var(--forest-deep)]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl font-display italic text-base text-[color:var(--muted-foreground)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

/** Empty state visual consistente entre módulos. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mt-16 flex flex-col items-center gap-3 border border-dashed border-[color:var(--border)] px-6 py-16 text-center">
      <p className="font-display text-2xl text-[color:var(--forest-deep)]">{title}</p>
      {description && (
        <p className="max-w-md font-display italic text-sm text-[color:var(--muted-foreground)]">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

/** Estado de erro genérico com botão de retry. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mt-8 flex flex-col items-start gap-3 border border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/5 p-5">
      <p className="text-[11px] tracking-luxe uppercase text-[color:var(--destructive)]">Erro</p>
      <p className="text-sm text-[color:var(--forest-deep)]">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 h-10 border border-[color:var(--forest-deep)] px-4 text-[11px] tracking-luxe uppercase transition-colors hover:bg-[color:var(--forest-deep)] hover:text-[color:var(--cream)]"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

/** Skeleton simples reutilizável. */
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[color:var(--cream-deep)] ${className}`}
      aria-hidden="true"
    />
  );
}