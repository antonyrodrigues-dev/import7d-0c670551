/**
 * 7D IMPORTS — Pendências do pedido (funil único de reserva).
 *
 * Apresentação pura. O PREÇO OFICIAL É SEMPRE O DO CATÁLOGO: a RPC
 * `resolver_pendencias_pedido` ignora qualquer valor enviado por atendente.
 * Somente o Admin Master pode propor preço excepcional, obrigatoriamente com
 * motivo — que fica registrado na auditoria do pedido (antes/depois).
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOrderPendencies, usePermissions } from "../hooks";
import type { AdminOrder, PendencyItemInput } from "../types";

interface Draft {
  size: string;
  price: string;
}

export function OrderPendenciesPanel({ order, canEdit }: { order: AdminOrder; canEdit: boolean }) {
  const pendente = order.pendenciaPreco || order.pendenciaTamanho;
  const { isAdmin } = usePermissions();
  const { state, resolver } = useOrderPendencies(order.id);
  const inicial = useMemo<Draft[]>(
    () => order.itens.map((it) => ({ size: it.size ?? "", price: "" })),
    [order.itens],
  );
  const [draft, setDraft] = useState<Draft[]>(inicial);
  const [motivo, setMotivo] = useState("");

  if (!pendente) return null;

  const update = (idx: number, patch: Partial<Draft>) =>
    setDraft((d) => d.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const overrides = draft.some((d) => Number(d.price) > 0);
  const incompleto = draft.some((it) => !it.size.trim());
  const salvando = state === "saving";
  const bloqueado = incompleto || (overrides && !motivo.trim());

  const payload: PendencyItemInput[] = draft.map((d) => ({
    size: d.size,
    price: isAdmin && Number(d.price) > 0 ? Number(d.price) : null,
  }));

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
        Confirme o tamanho para reservar o estoque. O valor aplicado é sempre o preço oficial do
        catálogo.
      </p>

      <ul className="mt-4 space-y-3">
        {order.itens.map((it, idx) => (
          <li
            key={`${order.id}-pend-${idx}`}
            className={`grid gap-2 border-b border-[color:var(--border)] pb-3 sm:items-end ${
              isAdmin
                ? "sm:grid-cols-[minmax(0,1fr)_7rem_9rem]"
                : "sm:grid-cols-[minmax(0,1fr)_7rem]"
            }`}
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
            {isAdmin && (
              <label className="block">
                <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                  Preço excepcional
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={draft[idx]?.price ?? ""}
                  onChange={(e) => update(idx, { price: e.target.value })}
                  disabled={!canEdit || salvando}
                  placeholder="Catálogo"
                  aria-label={`Preço excepcional de ${it.name}`}
                />
              </label>
            )}
          </li>
        ))}
      </ul>

      {isAdmin && overrides && (
        <label className="mt-4 block">
          <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Motivo do preço excepcional (obrigatório)
          </span>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={!canEdit || salvando}
            placeholder="Ex.: acordo comercial autorizado"
            aria-label="Motivo do preço excepcional"
          />
        </label>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[color:var(--muted-foreground)]">
          O total oficial é recalculado pelo servidor com os preços do catálogo.
        </p>
        <Button
          size="sm"
          disabled={!canEdit || bloqueado || salvando}
          onClick={() => void resolver(payload, motivo || undefined)}
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
