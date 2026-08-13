/**
 * Motor de regras de preço por categoria.
 *
 * Fluxo obrigatório: escolher categoria -> ver PRÉVIA de impacto -> aplicar.
 * Nada é calculado aqui: preço, validação e gravação vivem no banco, restritos
 * ao Admin Master. Preços confirmados manualmente só são sobrescritos quando o
 * administrador marca a opção explicitamente.
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePriceRules } from "../hooks/data/usePriceRules";
import type { PriceRulePreview } from "../types";

const INPUT =
  "h-10 w-full border border-[color:var(--border)] bg-white px-2 text-sm text-[color:var(--forest-deep)] focus:border-[color:var(--forest-deep)] focus:outline-none disabled:opacity-60";
const LABEL = "block text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export function PriceRuleDialog({
  open,
  categories,
  onClose,
  onApplied,
}: {
  open: boolean;
  categories: string[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const { rules, apply, preview } = usePriceRules(open);
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [cardPrice, setCardPrice] = useState("");
  const [installments, setInstallments] = useState("");
  const [includeConfirmed, setIncludeConfirmed] = useState(false);
  const [impact, setImpact] = useState<PriceRulePreview | null>(null);
  const [busy, setBusy] = useState(false);

  const current = useMemo(
    () => rules.find((r) => r.category === category) ?? null,
    [rules, category],
  );

  // Categoria inicial e pré-preenchimento com a regra vigente.
  useEffect(() => {
    if (!open) return;
    setCategory((c) => (c && categories.includes(c) ? c : (categories[0] ?? "")));
  }, [open, categories]);

  useEffect(() => {
    if (!current) return;
    setPrice(String(current.price));
    setCardPrice(current.cardPrice == null ? "" : String(current.cardPrice));
    setInstallments(current.installments ?? "");
  }, [current]);

  // Prévia de impacto sempre sincronizada com categoria/escopo.
  useEffect(() => {
    let alive = true;
    if (!open || !category) {
      setImpact(null);
      return;
    }
    void preview(category, includeConfirmed).then((p) => {
      if (alive) setImpact(p);
    });
    return () => {
      alive = false;
    };
  }, [open, category, includeConfirmed, preview]);

  const priceNumber = Number(price.replace(",", "."));
  const cardNumber = cardPrice.trim() === "" ? null : Number(cardPrice.replace(",", "."));
  const valid =
    Boolean(category) &&
    priceNumber > 0 &&
    (cardNumber === null || cardNumber > 0) &&
    (impact?.affected ?? 0) >= 0;

  async function handleApply() {
    setBusy(true);
    const affected = await apply({
      category,
      price: priceNumber,
      cardPrice: cardNumber,
      installments: installments.trim() === "" ? null : installments.trim(),
      includeConfirmed,
    });
    setBusy(false);
    if (affected !== null) {
      onApplied();
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Regra de preço por categoria</DialogTitle>
          <DialogDescription>
            Define o preço oficial de toda uma categoria de uma vez. A prévia mostra exatamente
            quantas peças serão alteradas antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div>
            <label className={LABEL} htmlFor="regra-categoria">
              Categoria
            </label>
            <select
              id="regra-categoria"
              className={`${INPUT} mt-1`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="regra-preco">
                Preço (Pix / à vista)
              </label>
              <input
                id="regra-preco"
                inputMode="decimal"
                className={`${INPUT} mt-1`}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="105"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="regra-cartao">
                Preço no cartão
              </label>
              <input
                id="regra-cartao"
                inputMode="decimal"
                className={`${INPUT} mt-1`}
                value={cardPrice}
                onChange={(e) => setCardPrice(e.target.value)}
                placeholder="opcional"
              />
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="regra-parcelamento">
              Parcelamento exibido
            </label>
            <input
              id="regra-parcelamento"
              className={`${INPUT} mt-1`}
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              placeholder="Ex.: até 3x sem juros"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-[color:var(--muted-foreground)]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={includeConfirmed}
              onChange={(e) => setIncludeConfirmed(e.target.checked)}
            />
            <span>
              Sobrescrever também os preços já confirmados manualmente nesta categoria.
            </span>
          </label>

          <div className="border border-[color:var(--border)] bg-[color:var(--cream-deep)] px-4 py-3 text-sm">
            {impact ? (
              <>
                <p className="font-display text-lg text-[color:var(--forest-deep)]">
                  {impact.affected} de {impact.total} peça(s) serão atualizadas
                </p>
                <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                  {impact.confirmed} com preço já confirmado
                  {includeConfirmed ? " (serão sobrescritas)" : " (serão preservadas)"}.
                  {priceNumber > 0 ? ` Novo preço: ${brl(priceNumber)}.` : ""}
                </p>
              </>
            ) : (
              <p className="text-xs text-[color:var(--muted-foreground)]">Calculando impacto…</p>
            )}
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void handleApply()} disabled={!valid || busy}>
            {busy ? "Aplicando…" : "Aplicar regra"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
