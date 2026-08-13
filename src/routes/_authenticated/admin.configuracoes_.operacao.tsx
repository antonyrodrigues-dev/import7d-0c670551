import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { LoadingState } from "@/features/admin/components/AdminUI";
import { PermissionGate } from "@/features/admin/components/PermissionGate";
import { Button } from "@/components/ui/button";
import { useCheckoutBlocks, useOperationalParams } from "@/features/admin/hooks";
import { CHECKOUT_BLOCK_LABELS, PARAM_LIMITS } from "@/features/admin/types";
import type { CheckoutBlockReason, OperationalParamKey } from "@/features/admin/types";

export const Route = createFileRoute("/_authenticated/admin/configuracoes_/operacao")({
  head: () => ({
    meta: [
      { title: "Parâmetros operacionais — 7D IMPORTS" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OperacaoPage,
});

function OperacaoPage() {
  return (
    <PermissionGate
      perm="params:edit"
      title="Parâmetros operacionais"
      restrictedDescription="Somente o Administrador Master altera tempos de reserva e de atendimento."
    >
      <OperacaoView />
    </PermissionGate>
  );
}

const KEYS = Object.keys(PARAM_LIMITS) as OperationalParamKey[];

function OperacaoView() {
  const { state, params, save, validate } = useOperationalParams();
  const [draft, setDraft] = useState<Record<OperationalParamKey, string>>(
    () =>
      Object.fromEntries(KEYS.map((k) => [k, String(params[k])])) as Record<
        OperationalParamKey,
        string
      >,
  );

  useEffect(() => {
    setDraft(
      Object.fromEntries(KEYS.map((k) => [k, String(params[k])])) as Record<
        OperationalParamKey,
        string
      >,
    );
  }, [params]);

  if (state === "loading" && !params) return <LoadingState label="Carregando parâmetros…" />;

  return (
    <>
      <PageHeader
        eyebrow="Configurações"
        title="Parâmetros operacionais"
        description="Tempos oficiais de reserva, alerta e atraso. Toda alteração é registrada com autor e data."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/configuracoes">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Voltar às configurações
            </Link>
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {KEYS.map((key) => {
          const limit = PARAM_LIMITS[key];
          const value = Number(draft[key]);
          const erro = draft[key] === "" ? "Informe um valor." : validate(key, value);
          const alterado = String(params[key]) !== draft[key];
          return (
            <section
              key={key}
              className="flex flex-col gap-2 border border-[color:var(--border)] bg-[color:var(--cream)] p-4"
            >
              <label className="text-[10px] tracking-luxe uppercase" htmlFor={`param-${key}`}>
                {limit.label}
              </label>
              <input
                id={`param-${key}`}
                type="number"
                inputMode="numeric"
                min={limit.min}
                max={limit.max}
                value={draft[key]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                aria-invalid={Boolean(erro)}
                className="h-11 w-full border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm tabular-nums"
              />
              <p className="text-[11px] text-[color:var(--muted-foreground)]">
                {limit.hint} Entre {limit.min} e {limit.max} {limit.unidade}.
              </p>
              {erro && <p className="text-[11px] text-[color:var(--destructive)]">{erro}</p>}
              <Button
                size="sm"
                className="self-start"
                disabled={Boolean(erro) || !alterado || state === "saving"}
                onClick={() => void save(key, value)}
              >
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                {state === "saving" ? "Salvando…" : "Salvar"}
              </Button>
            </section>
          );
        })}
      </div>

      <CheckoutBlocksPanel />
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/** Registro imutável das tentativas de checkout recusadas pela proteção anti-abuso. */
function CheckoutBlocksPanel() {
  const { blocks, loading } = useCheckoutBlocks();

  return (
    <section className="mt-8 border border-[color:var(--border)] bg-[color:var(--cream)] p-4">
      <h2 className="text-[10px] tracking-luxe uppercase">Tentativas bloqueadas no checkout</h2>
      <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">
        Registro imutável das últimas recusas da proteção anti-abuso. O telefone aparece
        mascarado.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-[color:var(--muted-foreground)]">Carregando registro…</p>
      ) : blocks && blocks.length > 0 ? (
        <ul className="mt-4 divide-y divide-[color:var(--border)]">
          {blocks.map((b) => (
            <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span className="text-sm">
                <span className="font-medium tabular-nums">{b.telefoneMascarado}</span>{" "}
                <span className="text-[color:var(--muted-foreground)]">
                  — {CHECKOUT_BLOCK_LABELS[b.motivo as CheckoutBlockReason] ?? b.motivo}
                </span>
              </span>
              <span className="text-[11px] tabular-nums text-[color:var(--muted-foreground)]">
                {dateFmt.format(new Date(b.criadoEm))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[color:var(--muted-foreground)]">
          Nenhuma tentativa bloqueada até agora.
        </p>
      )}
    </section>
  );
}
