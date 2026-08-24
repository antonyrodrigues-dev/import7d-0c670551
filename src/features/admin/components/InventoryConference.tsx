/**
 * MODO CONFERÊNCIA RÁPIDA — 7D IMPORTS
 *
 * Uma peça por vez, com a peça física na mão: foto, SKU, preço oficial,
 * tamanho + origem + evidência e a quantidade realmente contada.
 * Só a confirmação humana ("Conferi fisicamente") grava a conferência —
 * nunca existe marcação em massa. Cada confirmação é UMA operação atômica
 * no banco (`conferir_produto`), que reavalia a publicação da peça.
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { CatalogDiagnostic } from "../types";
import type { ConferenceInput, ConfirmedSizeOrigin } from "../adapters/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Peças que ainda dependem de conferência física (fonte: diagnóstico do banco). */
  pending: CatalogDiagnostic[];
  onConfirm: (input: ConferenceInput) => Promise<unknown>;
}

const ORIGIN_OPTIONS: { value: ConfirmedSizeOrigin; label: string }[] = [
  { value: "confirmado_etiqueta", label: "Etiqueta da peça" },
  { value: "confirmado_medicao", label: "Medição física" },
];

const inputClass =
  "h-11 w-full min-w-0 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm text-[color:var(--forest-deep)] focus:border-[color:var(--forest-deep)] focus:outline-none";

export function InventoryConference({ open, onOpenChange, pending, onConfirm }: Props) {
  const [index, setIndex] = useState(0);
  const current = pending[Math.min(index, Math.max(pending.length - 1, 0))];

  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [origin, setOrigin] = useState<ConfirmedSizeOrigin>("confirmado_etiqueta");
  const [evidence, setEvidence] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  const suggestedSize = useMemo(() => current?.sizes[0]?.tamanho ?? "", [current]);

  // Cada peça começa com o formulário limpo: nada é herdado da anterior.
  useEffect(() => {
    if (!current) return;
    setPrice(
      current.priceStatus === "confirmado" && current.price > 0 ? String(current.price) : "",
    );
    setSize(suggestedSize);
    setOrigin("confirmado_etiqueta");
    setEvidence("");
    setQuantity(String(current.sizes[0]?.quantidade ?? 1));
    setChecked(false);
  }, [current, suggestedSize]);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const isKit = current?.stockModel === "kit";

  const submit = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await onConfirm({
        productId: current.id,
        price: Number(price.replace(",", ".")),
        size,
        origin,
        evidence,
        quantity: isKit ? 0 : Number(quantity),
      });
      if (index + 1 < pending.length) setIndex((i) => i + 1);
      else onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    checked &&
    !busy &&
    size.trim() !== "" &&
    evidence.trim() !== "" &&
    Number(price.replace(",", ".")) > 0 &&
    (isKit || Number(quantity) >= 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Conferência rápida</DialogTitle>
          <DialogDescription>
            {pending.length === 0
              ? "Nenhuma peça aguardando conferência física."
              : `Peça ${Math.min(index + 1, pending.length)} de ${pending.length} — confirme com a peça em mãos.`}
          </DialogDescription>
        </DialogHeader>

        {!current ? (
          <p className="py-8 text-center text-sm text-[color:var(--muted-foreground)]">
            Tudo conferido. Nada pendente por aqui.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="h-40 w-full shrink-0 overflow-hidden border border-[color:var(--border)] bg-[color:var(--cream)] sm:h-36 sm:w-28">
                {current.cover ? (
                  <img
                    src={current.cover}
                    alt={`Foto de ${current.name}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center px-2 text-center text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                    Sem foto
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-display text-xl text-[color:var(--forest-deep)]">
                  {current.name}
                </p>
                <p className="text-[11px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                  {current.sku} · {current.brand} · {current.category}
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-[11px] text-[color:var(--muted-foreground)]">
                  {current.blockingReasons.slice(0, 4).map((r) => (
                    <li key={r}>· {r}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[11px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Preço oficial (R$)
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0,00"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Tamanho conferido
                <input
                  className={inputClass}
                  value={size}
                  onChange={(e) => setSize(e.target.value.toUpperCase())}
                  placeholder="Ex.: M"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Origem do tamanho
                <select
                  className={inputClass}
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value as ConfirmedSizeOrigin)}
                >
                  {ORIGIN_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Quantidade física
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  step={1}
                  disabled={isKit}
                  value={isKit ? "" : quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={isKit ? "Kit — saldo vem das peças" : "0"}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] tracking-luxe uppercase text-[color:var(--muted-foreground)] sm:col-span-2">
                Evidência do tamanho
                <input
                  className={inputClass}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="Ex.: etiqueta interna M / medição ombro 45cm"
                />
              </label>
            </div>

            <label className="flex items-start gap-3 border border-[color:var(--border)] bg-[color:var(--cream)] p-3 text-sm text-[color:var(--forest-deep)]">
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => setChecked(v === true)}
                aria-label="Conferi fisicamente"
              />
              <span>
                Conferi fisicamente esta peça: preço, tamanho e quantidade acima correspondem ao
                item real.
              </span>
            </label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => setIndex((i) => Math.min(i + 1, pending.length - 1))}
                disabled={busy || index + 1 >= pending.length}
              >
                Pular esta peça <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
              <Button onClick={() => void submit()} disabled={!canSubmit}>
                <Check className="mr-1 h-4 w-4" />
                {busy ? "Gravando…" : "Confirmar e próximo"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
