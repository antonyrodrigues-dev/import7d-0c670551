/**
 * 7D IMPORTS — Pendências do pedido (funil único de reserva).
 *
 * Apresentação pura: a validação real (catálogo, tamanho confirmado, saldo
 * e total oficial) acontece na RPC `resolver_pendencias_pedido`.
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/features/catalog";
import { useOrderPendencies } from "../hooks";
import type { AdminOrder, PendencyItemInput } from "../types";

export function OrderPendenciesPanel({ order, canEdit }: { order: AdminOrder; canEdit: boolean }) {
  const pendente = order.pendenciaPreco || order.pendenciaTamanho;
  const { state, resolver } = useOrderPendencies(order.id);
  const inicial = useMemo<PendencyItemInput[]>(
    () => order.itens.map((it) => ({ size: it.size ?? "", price: it.price > 0 ? it.price : 0 })),
    [order.itens],
  );
  const [draft, setDraft] = useState<PendencyItemInput[]>(inicial);

  if (!pendente) return null;

  const update = (idx: number, patch: Partial<PendencyItemInput>) =>
    setDraft((d) => d.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const previsto = draft.reduce(
    (acc, it, i) => acc + (it.price || 0) * (order.itens[i]?.quantity ?? 1),
    0,
  );
  const incompleto = draft.some((it) => !it.size.trim() || !(it.price > 0));
  const salvando = state === "saving";

  return (
    <section
      className="mt-6 border border-[color:var(--gold)]/45 bg-[color:var(--gold)]/5 p-4"
      aria-label="Pendências do pedido"
    >
      <h3 className="text-[10px] tracking-luxe uppercase text-[color:var(--forest-deep)]">
        Pendências do atendimento
      </h3>
      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
        {order.pendenciaTamanho && order.pendenciaPreco
          ? "Este pedido tem peças sem tamanho e sem preço confirmados."
          : order.pendenciaTamanho
            ? "Este pedido tem peças sem tamanho confirmado."
            : "Este pedido tem peças sem preço confirmado."}{" "}
        Confirme os dados abaixo para reservar o estoque e liberar o pagamento.
      </p>

      <ul className="mt-4 space-y-3">
        {order.itens.map((it, idx) => (
          <li
            key={`${order.id}-pend-${idx}`}
            className="grid gap-2 border-b border-[color:var(--border)] pb-3 sm:grid-cols-[minmax(0,1fr)_7rem_9rem] sm:items-end"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-[color:var(--forest-deep)]">{it.name}</p>
              <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                {it.quantity}× · {it.size ? `Tam ${it.size}` : "Tamanho a definir"}
              </p>
            </div>
            <label className="block">
              <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Tamanho
              </span>
              <Input
                value={draft[idx]?.size ?? ""}
                onChange={(e) => update(idx, { size: e.target.value })}
                disabled={!canEdit || salvando}
                placeholder="Ex.: 40"
                aria-label={`Tamanho de ${it.name}`}
              />
            </label>
            <label className="block">
              <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                Preço unitário
              </span>
              <Input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={draft[idx]?.price ? String(draft[idx].price) : ""}
                onChange={(e) => update(idx, { price: Number(e.target.value) })}
                disabled={!canEdit || salvando}
                placeholder="0,00"
                aria-label={`Preço de ${it.name}`}
              />
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[color:var(--muted-foreground)]">
          Subtotal previsto:{" "}
          <span className="tabular-nums text-[color:var(--forest-deep)]">
            {formatBRL(previsto)}
          </span>
        </p>
        <Button
          size="sm"
          disabled={!canEdit || incompleto || salvando}
          onClick={() => void resolver(draft)}
        >
          {salvando ? "Confirmando…" : "Confirmar e reservar"}
        </Button>
      </div>
      {!canEdit && (
        <p className="mt-2 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          Somente o responsável pelo atendimento pode confirmar.
        </p>
      )}
    </section>
  );
}
