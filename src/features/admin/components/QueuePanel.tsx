import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Inbox,
  MessageCircle,
  RefreshCw,
  TimerOff,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/features/admin/components/PageHeader";
// eslint-disable-next-line no-restricted-imports
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/features/admin/components/AdminUI";
import { PermissionGate } from "@/features/admin/components/PermissionGate";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/features/catalog";
import { ResponsiveDataTable, type DataTableColumn } from "@/features/admin/components/DataTable";
import { StatusBadge } from "@/features/admin/components/StatusBadge";
import { useQueue, useTeam, usePermissions } from "@/features/admin/hooks";
import type { BadgeTone } from "@/features/admin/lib/orderView";
import type { QueueOrder } from "@/features/admin/types";

/**
 * Fila de atendimento — vive dentro da central de Pedidos (aba Atendimento).
 * Não existe mais rota própria: Pedidos é o único ponto de entrada operacional.
 */
export function QueuePanel() {
  return (
    <PermissionGate
      perm="queue:view"
      title="Atendimentos"
      restrictedDescription="Acesso aguardando liberação pelo Administrador Master."
    >
      <FilaView />
    </PermissionGate>
  );
}

function FilaView() {
  const {
    state,
    fila,
    emAtendimento,
    params,
    atualizadoEm,
    refresh,
    assumir,
    transferir,
    devolverParaFila,
  } = useQueue();
  const { isAdmin, userId } = usePermissions();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<QueueOrder | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<QueueOrder | null>(null);

  const atrasados = useMemo(
    () => emAtendimento.filter((o) => o.prioridade === "atrasado"),
    [emAtendimento],
  );
  const emCurso = useMemo(
    () => emAtendimento.filter((o) => o.prioridade !== "atrasado"),
    [emAtendimento],
  );
  const meusAtendimentos = useMemo(
    () => emAtendimento.filter((o) => o.responsavelId === userId),
    [emAtendimento, userId],
  );

  const handleAssumir = async (order: QueueOrder) => {
    setBusyId(order.id);
    try {
      await assumir(order.id);
    } finally {
      setBusyId(null);
    }
  };

  const handleDevolver = async () => {
    if (!releaseTarget) return;
    await devolverParaFila(releaseTarget.id);
    setReleaseTarget(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Pedidos"
        title="Fila de atendimento"
        description="Fila oficial de pedidos aguardando e em atendimento, sincronizada em tempo real."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={state === "loading"}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Atualizar
          </Button>
        }
      />

      <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
        Alerta em {params.alertaAtendimentoMinutos} min · Atrasado em{" "}
        {params.atendimentoAtrasadoMinutos} min · Reserva de {params.reservaMinutos} min
        {atualizadoEm
          ? ` · Atualizado às ${new Date(atualizadoEm).toLocaleTimeString("pt-BR")}`
          : ""}
        {state === "saving" ? " · Atualizando…" : ""}
      </p>

      {state === "error" && (
        <ErrorState
          message="Não foi possível carregar a fila de atendimento."
          onRetry={() => void refresh()}
        />
      )}

      {state === "loading" && fila.length + emAtendimento.length === 0 && (
        <LoadingState label="Carregando fila…" />
      )}

      {state !== "loading" && state !== "error" && fila.length + emAtendimento.length === 0 && (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="Nenhum atendimento na fila"
          description="Novos pedidos aparecem aqui automaticamente, sem recarregar a página."
        />
      )}

      <QueueSection
        title="Aguardando atendimento"
        orders={fila}
        emptyLabel="Nenhum pedido aguardando."
        renderActions={(o) => (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busyId === o.id || state === "saving"}
              onClick={() => void handleAssumir(o)}
            >
              <UserCheck className="mr-2 h-4 w-4" aria-hidden="true" />
              {busyId === o.id ? "Assumindo…" : "Assumir atendimento"}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/admin/pedidos" search={{}}>
                Abrir pedido
              </Link>
            </Button>
          </div>
        )}
      />

      <QueueSection
        title="Meus atendimentos"
        orders={meusAtendimentos}
        emptyLabel="Você não possui atendimentos em curso."
        renderActions={(o) => (
          <Actions
            order={o}
            isAdmin={isAdmin}
            userId={userId}
            onTransfer={() => setTransferTarget(o)}
            onRelease={() => setReleaseTarget(o)}
          />
        )}
      />

      <QueueSection
        title="Atendimento atrasado"
        orders={atrasados}
        emptyLabel="Nenhum atendimento atrasado."
        renderActions={(o) => (
          <Actions
            order={o}
            isAdmin={isAdmin}
            userId={userId}
            onTransfer={() => setTransferTarget(o)}
            onRelease={() => setReleaseTarget(o)}
          />
        )}
      />

      <QueueSection
        title="Em atendimento"
        orders={emCurso}
        emptyLabel="Nenhum atendimento em curso."
        renderActions={(o) => (
          <Actions
            order={o}
            isAdmin={isAdmin}
            userId={userId}
            onTransfer={() => setTransferTarget(o)}
            onRelease={() => setReleaseTarget(o)}
          />
        )}
      />

      {transferTarget && (
        <TransferDialog
          order={transferTarget}
          onClose={() => setTransferTarget(null)}
          onConfirm={async (novoResponsavel, obs) => {
            await transferir(transferTarget.id, novoResponsavel, obs);
            setTransferTarget(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(releaseTarget)}
        onOpenChange={(open) => !open && setReleaseTarget(null)}
        title="Devolver para a fila"
        description={`O pedido ${releaseTarget?.numero ?? ""} volta para a fila e fica disponível para qualquer vendedor.`}
        confirmLabel="Devolver"
        onConfirm={handleDevolver}
      />
    </>
  );
}

function Actions({
  order,
  isAdmin,
  userId,
  onTransfer,
  onRelease,
}: {
  order: QueueOrder;
  isAdmin: boolean;
  userId: string | null;
  onTransfer: () => void;
  onRelease: () => void;
}) {
  if (!isAdmin) {
    return (
      <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
        {order.responsavelId === userId
          ? "Você é o responsável por este atendimento."
          : "Somente o Administrador Master pode transferir ou devolver este atendimento."}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={onTransfer}>
        Transferir atendimento
      </Button>
      <Button size="sm" variant="outline" onClick={onRelease}>
        Devolver para a fila
      </Button>
    </div>
  );
}

function priorityTone(p: QueueOrder["prioridade"]): BadgeTone {
  if (p === "atrasado") return "danger";
  if (p === "alerta") return "warn";
  return "neutral";
}

/** Fila e atendimento reutilizam a mesma tabela/card de Pedidos, sem duplicar HTML. */
function QueueSection({
  title,
  orders,
  emptyLabel,
  renderActions,
}: {
  title: string;
  orders: QueueOrder[];
  emptyLabel: string;
  renderActions: (o: QueueOrder) => React.ReactNode;
}) {
  const columns: DataTableColumn<QueueOrder>[] = [
    {
      key: "numero",
      header: "Nº do pedido",
      width: "8%",
      cell: (o) => <span className="font-display tabular-nums">{o.numero}</span>,
    },
    {
      key: "cliente",
      header: "Cliente",
      width: "15%",
      cell: (o) => (
        <span>
          {o.cliente}
          <span className="block text-[10px] text-[color:var(--muted-foreground)]">
            {o.telefone}
          </span>
        </span>
      ),
    },
    {
      key: "canal",
      header: "Modalidade",
      width: "8%",
      cell: (o) => (o.modalidade === "entrega" ? "Entrega" : "Retirada"),
    },
    {
      key: "itens",
      header: "Itens",
      width: "14%",
      cell: (o) => `${o.quantidadeItens} item(ns)`,
    },
    {
      key: "valor",
      header: "Valor",
      width: "9%",
      align: "right",
      cell: (o) => <span className="tabular-nums">{formatBRL(o.valorTotal)}</span>,
    },
    {
      key: "responsavel",
      header: "Responsável",
      width: "9%",
      cell: (o) => o.responsavelNome ?? "—",
    },
    {
      key: "status",
      header: "Prioridade",
      width: "12%",
      noTruncate: true,
      cell: (o) => (
        <StatusBadge tone={priorityTone(o.prioridade)} icon={<Clock className="h-3 w-3" />}>
          {o.prioridade}
        </StatusBadge>
      ),
    },
    {
      key: "espera",
      header: "Aguardando",
      width: "8%",
      cell: (o) => (
        <span className={o.prioridade === "atrasado" ? "font-semibold text-red-700" : ""}>
          {o.aguardandoMinutos} min
        </span>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      width: "17%",
      align: "right",
      noTruncate: true,
      cell: (o) => <div className="flex justify-end">{renderActions(o)}</div>,
    },
  ];

  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl text-[color:var(--forest-deep)]">{title}</h2>
        <span className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          {orders.length} pedido{orders.length === 1 ? "" : "s"}
        </span>
      </header>
      {orders.length === 0 ? (
        <p className="border border-dashed border-[color:var(--border)] px-4 py-6 text-center text-sm text-[color:var(--muted-foreground)]">
          {emptyLabel}
        </p>
      ) : (
        <ResponsiveDataTable
          ariaLabel={title}
          columns={columns}
          rows={orders}
          keyFor={(o) => o.id}
          renderCard={(o) => <QueueCard order={o} actions={renderActions(o)} />}
        />
      )}
    </section>
  );
}

function QueueCard({ order: o, actions }: { order: QueueOrder; actions: React.ReactNode }) {
  const reservaExpirada = o.reservaMinutosRestantes !== null && o.reservaMinutosRestantes <= 0;
  const reservaProxima =
    o.reservaMinutosRestantes !== null &&
    o.reservaMinutosRestantes > 0 &&
    o.reservaMinutosRestantes <= 5;
  return (
    <div className="border border-[color:var(--border)] bg-[color:var(--cream)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl tabular-nums text-[color:var(--forest-deep)]">
            {o.numero}
          </p>
          <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">
            {o.cliente} · {o.telefone} · {o.modalidade === "entrega" ? "Entrega" : "Retirada"}
          </p>
          <p className="mt-1 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            {new Date(o.criadoEm).toLocaleString("pt-BR")} · aguardando {o.aguardandoMinutos} min ·{" "}
            {o.quantidadeItens} item(ns)
            {o.responsavelNome ? ` · Resp. ${o.responsavelNome}` : " · Sem responsável"}
          </p>
        </div>
        <p className="font-display text-xl tabular-nums text-[color:var(--forest-deep)]">
          {formatBRL(o.valorTotal)}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <StatusBadge tone={priorityTone(o.prioridade)} icon={<Clock className="h-3 w-3" />}>
          Prioridade {o.prioridade}
        </StatusBadge>
        <StatusBadge
          tone={o.whatsappDeclarado ? "success" : "neutral"}
          icon={<MessageCircle className="h-3 w-3" />}
        >
          {o.whatsappDeclarado ? "WhatsApp declarado" : "Sem declaração do cliente"}
        </StatusBadge>
        {o.reservaMinutosRestantes !== null && (
          <StatusBadge
            tone={reservaExpirada ? "danger" : reservaProxima ? "warn" : "success"}
            icon={
              reservaExpirada ? <TimerOff className="h-3 w-3" /> : <Clock className="h-3 w-3" />
            }
          >
            {reservaExpirada
              ? "Reserva expirada — estoque não garantido"
              : `Reserva expira em ${o.reservaMinutosRestantes} min`}
          </StatusBadge>
        )}
        {o.prioridade === "atrasado" && (
          <StatusBadge tone="danger" icon={<AlertTriangle className="h-3 w-3" />}>
            Atendimento atrasado
          </StatusBadge>
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {o.itens.map((i, idx) => (
          <li
            key={`${o.id}-${idx}`}
            className="border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--forest-deep)]"
          >
            {i.name} · Tam {i.size} · {i.quantity}×
          </li>
        ))}
      </ul>
      <div className="mt-3">{actions}</div>
    </div>
  );
}

function TransferDialog({
  order,
  onClose,
  onConfirm,
}: {
  order: QueueOrder;
  onClose: () => void;
  onConfirm: (novoResponsavel: string, observacao?: string) => Promise<void>;
}) {
  const { groups, state } = useTeam();
  const [target, setTarget] = useState("");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const candidatos = groups.ativos.filter((m) => m.userId !== order.responsavelId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Transferir atendimento do pedido ${order.numero}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--forest-deep)]/40 p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-md border border-[color:var(--border)] bg-[color:var(--cream)] p-5">
        <h2 className="font-display text-2xl text-[color:var(--forest-deep)]">
          Transferir atendimento
        </h2>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          Pedido {order.numero} — responsável atual: {order.responsavelNome ?? "—"}
        </p>
        <label className="mt-4 block text-[10px] tracking-luxe uppercase" htmlFor="transfer-target">
          Novo responsável
        </label>
        <select
          id="transfer-target"
          autoFocus
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="mt-1 h-11 w-full border border-[color:var(--border)] bg-[color:var(--cream)] px-3 text-sm"
        >
          <option value="">Selecione…</option>
          {candidatos.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.nome || m.email}
            </option>
          ))}
        </select>
        {state === "loading" && (
          <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)]">
            Carregando equipe…
          </p>
        )}
        <label className="mt-4 block text-[10px] tracking-luxe uppercase" htmlFor="transfer-obs">
          Observação (opcional)
        </label>
        <textarea
          id="transfer-obs"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          rows={3}
          className="mt-1 w-full border border-[color:var(--border)] bg-[color:var(--cream)] p-3 text-sm"
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!target || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(target, obs.trim() || undefined);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Transferindo…" : "Confirmar transferência"}
          </Button>
        </div>
      </div>
    </div>
  );
}
