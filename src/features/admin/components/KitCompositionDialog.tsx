/**
 * Composição de um kit — quais peças (produto + tamanho + quantidade) formam
 * cada tamanho do conjunto. O saldo do kit nunca é digitado: ele nasce do
 * menor múltiplo completo entre as peças, exatamente como o banco calcula.
 */

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useKitComposition } from "../hooks/data/useKitComposition";
import { eligibleComponents } from "../services/kits.service";
import type { InventoryItem } from "../types";

const INPUT =
  "h-10 w-full border border-[color:var(--border)] bg-white px-2 text-sm text-[color:var(--forest-deep)] focus:border-[color:var(--forest-deep)] focus:outline-none disabled:opacity-60";

export function KitCompositionDialog({
  kit,
  items,
  canEdit,
  onClose,
}: {
  kit: InventoryItem;
  items: InventoryItem[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const { sizes, state, add, remove } = useKitComposition(kit.id);
  const candidates = useMemo(() => eligibleComponents(items, kit.id), [items, kit.id]);

  const [kitSize, setKitSize] = useState(kit.sizes[0] ?? "");
  const [componentId, setComponentId] = useState(candidates[0]?.id ?? "");
  const [componentSize, setComponentSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);

  const selected = candidates.find((c) => c.id === componentId);
  const componentSizes = selected?.sizes ?? [];
  const effectiveSize = componentSize || (componentSizes[0] ?? "");

  const byKitSize = new Map(sizes.map((s) => [s.kitSize, s]));

  async function handleAdd() {
    if (!kitSize || !componentId || !effectiveSize) return;
    setBusy(true);
    await add({ kitId: kit.id, kitSize, componentId, componentSize: effectiveSize, quantity });
    setBusy(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Composição · {kit.name}</DialogTitle>
          <DialogDescription>
            Kit não tem estoque próprio. A disponibilidade de cada tamanho é o menor múltiplo
            completo entre as peças cadastradas abaixo.
          </DialogDescription>
        </DialogHeader>

        {kit.sizes.length === 0 ? (
          <p className="text-sm text-[color:var(--destructive)]">
            Cadastre ao menos um tamanho no kit antes de montar a composição.
          </p>
        ) : (
          <div className="max-h-[55vh] space-y-6 overflow-y-auto pr-1">
            {kit.sizes.map((size) => {
              const group = byKitSize.get(size);
              return (
                <section key={size}>
                  <header className="flex items-baseline justify-between gap-3">
                    <h3 className="text-[10px] tracking-luxe uppercase">Tamanho {size}</h3>
                    <span className="text-[11px] tabular-nums text-[color:var(--muted-foreground)]">
                      {state === "loading"
                        ? "calculando…"
                        : `${group?.available ?? 0} kit(s) disponíveis`}
                    </span>
                  </header>

                  {group && group.components.length > 0 ? (
                    <ul className="mt-2 divide-y divide-[color:var(--border)] border border-[color:var(--border)]">
                      {group.components.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between gap-3 px-3 py-2"
                        >
                          <span className="min-w-0 text-sm">
                            <span className="tabular-nums">{c.quantity}×</span> {c.componentName}
                            <span className="text-[color:var(--muted-foreground)]">
                              {" "}
                              · tam {c.componentSize} · {c.componentSku}
                            </span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="text-[11px] tabular-nums text-[color:var(--muted-foreground)]">
                              saldo {c.componentAvailable}
                            </span>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Remover ${c.componentName} do tamanho ${size}`}
                                onClick={() => void remove(c.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                      Nenhuma peça cadastrada — este tamanho não pode ser publicado nem vendido.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {canEdit && kit.sizes.length > 0 && (
          <div className="border-t border-[color:var(--border)] pt-4">
            <h3 className="text-[10px] tracking-luxe uppercase">Adicionar peça</h3>
            {candidates.length === 0 ? (
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                Nenhuma peça elegível: cadastre produtos com tamanho antes de montar o kit.
              </p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1.6fr_1fr_auto_auto]">
                <select
                  className={INPUT}
                  aria-label="Tamanho do kit"
                  value={kitSize}
                  onChange={(e) => setKitSize(e.target.value)}
                >
                  {kit.sizes.map((s) => (
                    <option key={s} value={s}>
                      Kit {s}
                    </option>
                  ))}
                </select>
                <select
                  className={INPUT}
                  aria-label="Peça componente"
                  value={componentId}
                  onChange={(e) => {
                    setComponentId(e.target.value);
                    setComponentSize("");
                  }}
                >
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  className={INPUT}
                  aria-label="Tamanho da peça"
                  value={effectiveSize}
                  onChange={(e) => setComponentSize(e.target.value)}
                >
                  {componentSizes.map((s) => (
                    <option key={s} value={s}>
                      Tam {s}
                    </option>
                  ))}
                </select>
                <input
                  className={`${INPUT} w-20 tabular-nums`}
                  aria-label="Quantidade por kit"
                  type="number"
                  min={1}
                  max={20}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                />
                <Button onClick={() => void handleAdd()} disabled={busy || !effectiveSize}>
                  Adicionar
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
