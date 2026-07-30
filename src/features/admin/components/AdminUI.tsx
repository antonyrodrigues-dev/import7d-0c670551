/**
 * 7D IMPORTS — Componentes visuais compartilhados do painel administrativo.
 *
 * Fonte única para EmptyState / LoadingState / ErrorState / ConfirmDialog /
 * DangerConfirmDialog / InitialsAvatar. Nenhuma tela pode criar sua própria
 * versão — importar exclusivamente daqui.
 */

import { useState, type ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mt-8 flex flex-col items-center gap-4 border border-dashed border-[color:var(--border)] bg-[color:var(--cream)] px-6 py-16 text-center">
      <div
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--cream-deep)]/60 text-[color:var(--gold)]"
      >
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="font-display text-2xl text-[color:var(--forest-deep)]">{title}</p>
      {description && (
        <p className="max-w-md font-display italic text-sm text-[color:var(--muted-foreground)]">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-8 flex flex-col items-center gap-3 border border-dashed border-[color:var(--border)] bg-[color:var(--cream)] px-6 py-16 text-center"
    >
      <Loader2
        className="h-6 w-6 animate-spin text-[color:var(--forest-deep)]"
        aria-hidden="true"
      />
      <p className="text-[11px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
        {label}
      </p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="mt-8 flex flex-col items-start gap-3 border border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/5 p-5"
    >
      <div className="flex items-center gap-2 text-[color:var(--destructive)]">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <p className="text-[11px] tracking-luxe uppercase">Não foi possível concluir a operação</p>
      </div>
      <p className="text-sm text-[color:var(--forest-deep)]">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function InitialsAvatar({
  name,
  size = 36,
}: {
  name: string | null | undefined;
  size?: number;
}) {
  const initials = getInitials(name);
  return (
    <div
      aria-hidden="true"
      style={{ height: size, width: size, fontSize: Math.round(size * 0.36) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-[color:var(--forest-deep)] font-display tracking-wide text-[color:var(--cream)]"
    >
      {initials}
    </div>
  );
}

function getInitials(name: string | null | undefined): string {
  const clean = (name ?? "").trim();
  if (!clean) return "—";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handle();
            }}
            className={
              destructive
                ? "bg-[color:var(--destructive)] text-[color:var(--destructive-foreground)] hover:bg-[color:var(--destructive)]/90"
                : undefined
            }
          >
            {busy ? "Processando…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Diálogo de confirmação para ações destrutivas de alto risco.
 * Exige que o usuário digite a palavra `confirmationWord` (padrão "EXCLUIR")
 * antes de habilitar o botão. Sempre pareado com toast Sonner de feedback.
 */
export function DangerConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmationWord = "EXCLUIR",
  confirmLabel = "Excluir",
  cancelLabel = "Cancelar",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmationWord?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = value.trim().toUpperCase() === confirmationWord.toUpperCase();

  const close = (next: boolean) => {
    if (!next) setValue("");
    onOpenChange(next);
  };

  const handle = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await onConfirm();
      close(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-[color:var(--destructive)]">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="danger-confirm-input" className="text-xs">
            Para confirmar, digite{" "}
            <span className="font-mono font-semibold text-[color:var(--forest-deep)]">
              {confirmationWord}
            </span>{" "}
            abaixo.
          </Label>
          <Input
            id="danger-confirm-input"
            autoFocus
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={value.length > 0 && !valid}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!valid || busy}
            onClick={(e) => {
              e.preventDefault();
              void handle();
            }}
            className="bg-[color:var(--destructive)] text-[color:var(--destructive-foreground)] hover:bg-[color:var(--destructive)]/90"
          >
            {busy ? "Processando…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
