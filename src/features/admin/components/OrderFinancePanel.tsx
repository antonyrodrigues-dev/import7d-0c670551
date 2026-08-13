/**
 * 7D IMPORTS — Painel financeiro do pedido (pagamentos + devoluções).
 *
 * Camada de apresentação pura: toda regra vive em `useOrderFinance` →
 * services → RPCs. O valor do pagamento nunca é digitado aqui — o banco
 * grava sempre o valor oficial do pedido.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/features/catalog";
import { useOrderFinance, usePermissions } from "../hooks";
import { nextPaymentStates } from "../lib/paymentMachine";
import { PAYMENT_STATES, RETURN_CONDITIONS } from "../types";
import type {
  AdminOrder,
  LedgerEntry,
  PaymentState,
  ReturnCondition,
  ReturnItemInput,
} from "../types";

export function OrderFinancePanel({ order }: { order: AdminOrder }) {
  const { isAdmin } = usePermissions();
  const {
    state,
    payments,
    returns,
    ledger,
    saldoLedger,
    alterarPagamento,
    registrarDevolucao,
    requiresAdmin,
  } = useOrderFinance(order.id);
  const [aba, setAba] = useState<"pagamento" | "devolucao" | "extrato">("pagamento");

  // Fonte única: estado canônico gravado no pedido pelo servidor.
  const atual: PaymentState = order.pagamentoEstado ?? "pendente";

  return (
    <section
      className="mt-4 border-t border-[color:var(--border)] pt-4"
      aria-label="Financeiro do pedido"
    >
      <div className="flex flex-wrap gap-2">
        {(["pagamento", "devolucao", "extrato"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            className={`h-9 border px-3 text-[10px] tracking-luxe uppercase transition-colors ${
              aba === k
                ? "border-[color:var(--forest-deep)] bg-[color:var(--forest-deep)] text-[color:var(--cream)]"
                : "border-[color:var(--border)] text-[color:var(--forest-deep)]"
            }`}
          >
            {k === "pagamento"
              ? `Pagamento (${payments.length})`
              : k === "devolucao"
                ? `Devoluções (${returns.length})`
                : `Extrato (${ledger.length})`}
          </button>
        ))}
        <span className="self-center text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          {state === "loading"
            ? "Carregando…"
            : state === "saving"
              ? "Salvando…"
              : `Estado: ${atual}`}
        </span>
      </div>

      {aba === "pagamento" ? (
        <PaymentTab
          order={order}
          isAdmin={isAdmin}
          atual={atual}
          disabled={state === "saving" || state === "loading"}
          requiresAdmin={requiresAdmin}
          onApply={alterarPagamento}
          history={payments}
        />
      ) : aba === "devolucao" ? (
        <ReturnTab
          order={order}
          isAdmin={isAdmin}
          disabled={state === "saving" || state === "loading"}
          onSubmit={registrarDevolucao}
          history={returns}
        />
      ) : (
        <LedgerTab isAdmin={isAdmin} entries={ledger} saldo={saldoLedger} />
      )}
    </section>
  );
}

function LedgerTab({
  isAdmin,
  entries,
  saldo,
}: {
  isAdmin: boolean;
  entries: LedgerEntry[];
  saldo: number;
}) {
  if (!isAdmin) {
    return (
      <p className="mt-3 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
        Extrato financeiro visível apenas para o Administrador Master.
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-[11px] text-[color:var(--muted-foreground)]">
        Livro-razão imutável — receitas nascem da confirmação de pagamento; estornos, de devolução
        ou estorno. Saldo líquido:{" "}
        <strong className="tabular-nums">{formatBRL(saldo)}</strong>
      </p>
      {entries.length === 0 ? (
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          Nenhum lançamento para este pedido.
        </p>
      ) : (
        <ol className="space-y-1">
          {entries.map((l) => (
            <li key={l.id} className="text-[11px] text-[color:var(--forest-deep)]">
              <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                {new Date(l.criadoEm).toLocaleString("pt-BR")}
              </span>{" "}
              · {l.tipo === "receita" ? "Receita" : "Estorno"} ({l.origem}) ·{" "}
              <span className="tabular-nums">{formatBRL(l.valor)}</span>
              {l.metodo ? ` · ${l.metodo}` : ""}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function PaymentTab({
  order,
  isAdmin,
  atual,
  disabled,
  requiresAdmin,
  onApply,
  history,
}: {
  order: AdminOrder;
  isAdmin: boolean;
  atual: PaymentState;
  disabled: boolean;
  requiresAdmin: (e: PaymentState) => boolean;
  onApply: (
    estado: PaymentState,
    extras?: { comprovanteUrl?: string; observacao?: string },
  ) => Promise<boolean>;
  history: {
    id: string;
    estado: string;
    valor: number;
    criadoEm: string;
    observacao: string | null;
  }[];
}) {
  const [comprovante, setComprovante] = useState("");
  const [obs, setObs] = useState("");

  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="text-[11px] text-[color:var(--muted-foreground)]">
        Valor oficial do pedido:{" "}
        <strong className="tabular-nums">{formatBRL(order.valorTotal)}</strong> — gravado pelo
        servidor, nunca informado manualmente.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[10px] tracking-luxe uppercase">
          Link do comprovante (opcional)
          <input
            value={comprovante}
            onChange={(e) => setComprovante(e.target.value)}
            className="h-10 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm normal-case tracking-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] tracking-luxe uppercase">
          Observação (opcional)
          <input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            className="h-10 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm normal-case tracking-normal"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {PAYMENT_STATES.map((s) => {
          const bloqueado = requiresAdmin(s.key) && !isAdmin;
          const permitido = nextPaymentStates(atual).includes(s.key);
          return (
            <Button
              key={s.key}
              size="sm"
              variant={s.key === atual ? "default" : "outline"}
              disabled={disabled || bloqueado || s.key === atual || !permitido}
              title={
                bloqueado
                  ? "Somente o Administrador Master pode aplicar este estado."
                  : !permitido && s.key !== atual
                    ? `Transição não permitida a partir de "${atual}".`
                    : undefined
              }
              onClick={() =>
                void onApply(s.key, {
                  comprovanteUrl: comprovante.trim() || undefined,
                  observacao: obs.trim() || undefined,
                })
              }
            >
              {s.label}
            </Button>
          );
        })}
      </div>
      {!isAdmin && (
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          Confirmar e estornar são exclusivos do Administrador Master.
        </p>
      )}
      {history.length > 0 && (
        <ol className="mt-1 space-y-1">
          {history.map((p) => (
            <li key={p.id} className="text-[11px] text-[color:var(--forest-deep)]">
              <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                {new Date(p.criadoEm).toLocaleString("pt-BR")}
              </span>{" "}
              · {p.estado} · <span className="tabular-nums">{formatBRL(p.valor)}</span>
              {p.observacao ? ` · ${p.observacao}` : ""}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ReturnTab({
  order,
  isAdmin,
  disabled,
  onSubmit,
  history,
}: {
  order: AdminOrder;
  isAdmin: boolean;
  disabled: boolean;
  onSubmit: (input: {
    itens: ReturnItemInput[];
    motivo: string;
    valorEstornado: number;
    observacoes?: string | null;
  }) => Promise<boolean>;
  history: {
    id: string;
    motivo: string;
    valorEstornado: number;
    criadoEm: string;
    itens: { slug: string; tamanho: string; quantidade: number; condicao: string }[];
  }[];
}) {
  const [qtd, setQtd] = useState<Record<number, number>>({});
  const [cond, setCond] = useState<Record<number, ReturnCondition>>({});
  const [motivo, setMotivo] = useState("");
  const [valor, setValor] = useState("0");
  const [obs, setObs] = useState("");

  if (!isAdmin) {
    return (
      <p className="mt-3 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
        Somente o Administrador Master registra devoluções.
      </p>
    );
  }
  if (order.status !== "finalizado" && history.length === 0) {
    return (
      <p className="mt-3 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
        Devolução disponível apenas para pedidos finalizados.
      </p>
    );
  }

  const itens: ReturnItemInput[] = order.itens
    .map((it, idx) => ({
      slug: it.slug,
      size: it.size,
      quantity: qtd[idx] ?? 0,
      condicao: cond[idx] ?? ("vendavel" as ReturnCondition),
    }))
    .filter((i) => i.quantity > 0);

  const valorNum = Number(valor.replace(",", "."));
  const invalido =
    itens.length === 0 || !motivo.trim() || !Number.isFinite(valorNum) || valorNum < 0;

  return (
    <div className="mt-3 flex flex-col gap-3">
      {order.status === "finalizado" && (
        <>
          <ul className="flex flex-col gap-2">
            {order.itens.map((it, idx) => (
              <li
                key={`${order.id}-ret-${idx}`}
                className="flex flex-wrap items-center gap-3 border border-[color:var(--border)] p-3 text-sm"
              >
                <span className="min-w-0 flex-1">
                  {it.name} · Tam {it.size} · vendidos {it.quantity}
                </span>
                <label className="flex items-center gap-1 text-[10px] tracking-luxe uppercase">
                  Qtd
                  <input
                    type="number"
                    min={0}
                    max={it.quantity}
                    value={qtd[idx] ?? 0}
                    onChange={(e) =>
                      setQtd((q) => ({
                        ...q,
                        [idx]: Math.max(0, Math.min(it.quantity, Number(e.target.value))),
                      }))
                    }
                    className="h-9 w-16 border border-[color:var(--border)] bg-[color:var(--cream)] px-2 text-sm tabular-nums"
                  />
                </label>
                <label className="flex items-center gap-1 text-[10px] tracking-luxe uppercase">
                  Condição
                  <select
                    value={cond[idx] ?? "vendavel"}
                    onChange={(e) =>
                      setCond((c) => ({ ...c, [idx]: e.target.value as ReturnCondition }))
                    }
                    className="h-9 border border-[color:var(--border)] bg-[color:var(--cream)] px-2 text-sm"
                  >
                    {RETURN_CONDITIONS.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label} — {c.estoque}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-[10px] tracking-luxe uppercase">
              Motivo
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="h-10 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm normal-case tracking-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] tracking-luxe uppercase">
              Valor estornado (R$)
              <input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="h-10 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm tabular-nums"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] tracking-luxe uppercase">
              Observações
              <input
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                className="h-10 border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm normal-case tracking-normal"
              />
            </label>
          </div>
          <Button
            size="sm"
            className="self-start"
            disabled={invalido || disabled}
            onClick={async () => {
              const ok = await onSubmit({
                itens,
                motivo: motivo.trim(),
                valorEstornado: valorNum,
                observacoes: obs.trim() || null,
              });
              if (ok) {
                setQtd({});
                setMotivo("");
                setValor("0");
                setObs("");
              }
            }}
          >
            Registrar devolução
          </Button>
        </>
      )}

      {history.length > 0 && (
        <ol className="space-y-2 border-t border-[color:var(--border)] pt-3">
          {history.map((d) => (
            <li key={d.id} className="text-[11px] text-[color:var(--forest-deep)]">
              <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                {new Date(d.criadoEm).toLocaleString("pt-BR")}
              </span>{" "}
              · {d.motivo} · estorno{" "}
              <span className="tabular-nums">{formatBRL(d.valorEstornado)}</span>
              <ul className="mt-1 pl-3">
                {d.itens.map((i, k) => (
                  <li key={`${d.id}-${k}`}>
                    {i.slug} · Tam {i.tamanho} · {i.quantidade}× · {i.condicao}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
