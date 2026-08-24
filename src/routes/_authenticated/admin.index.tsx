import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock,
  DollarSign,
  PackageX,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { StatCard } from "@/features/admin/components/StatCard";
import { PermissionGate } from "@/features/admin/components/PermissionGate";
import { formatBRL } from "@/features/catalog";
import { useDashboard } from "@/features/admin/hooks";
import { useOrdersStore } from "@/features/admin/stores/orders";
import { useInventoryStore } from "@/features/admin/stores/inventory";
import { OPERATIONAL_STATUSES } from "@/features/admin/lib/statusMachine";
import type { OrderStatus } from "@/features/admin/types";

function formatUpdatedAt(iso: string | undefined): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(
      new Date(iso),
    );
  } catch {
    return "";
  }
}

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [{ title: "Dashboard — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  // Fonte única: RPC `metricas_dashboard`. Nenhum card calcula nada e nenhum
  // pedido é carregado no navegador só para virar número.
  const { metrics: m, loading, error } = useDashboard();
  const navigate = useNavigate();
  const setStatuses = useOrdersStore((s) => s.setStatuses);
  const setStockFilter = useInventoryStore((s) => s.setFilterStatus);

  const goOrders = (statuses: OrderStatus[]) => {
    setStatuses(statuses);
    void navigate({ to: "/admin/pedidos" });
  };
  const goStock = (filter?: "ativos" | "inativos" | "todos" | "baixo") => {
    if (filter) setStockFilter(filter);
    void navigate({ to: "/admin/estoque" });
  };
  const goClients = () => void navigate({ to: "/admin/clientes" });

  return (
    <PermissionGate perm="orders:view" title="Dashboard">
      <PageHeader
        eyebrow="Painel"
        title="Dashboard"
        description="Visão consolidada da operação: atendimentos, pendências, estoque e financeiro."
      />
      {error && (
        <p role="alert" className="mb-4 border border-[color:var(--border)] p-3 text-sm">
          {error}
        </p>
      )}
      {m?.atualizadoEm && (
        <p className="mb-4 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          Última atualização · {formatUpdatedAt(m.atualizadoEm)}
        </p>
      )}
      <section
        aria-label="Indicadores"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <StatCard
          label="Aguardando atendimento"
          value={m?.atendimentosAguardando ?? 0}
          icon={<Clock className="h-5 w-5" />}
          hint="Pedidos sem responsável ativo"
          loading={loading}
          onClick={() => goOrders(["novo", "whatsapp_declarado", "aguardando_atendimento"])}
          ariaLabel="Ver fila de atendimento"
        />
        <StatCard
          label="Atendimentos atrasados"
          value={m?.atendimentosAtrasados ?? 0}
          icon={<AlertTriangle className="h-5 w-5" />}
          hint="Sem movimento há mais de 24h"
          trend={
            m && m.atendimentosAtrasados > 0
              ? { direction: "down", label: "Exige ação hoje" }
              : { direction: "flat", label: "Nenhum atraso" }
          }
          loading={loading}
          onClick={() => goOrders([...OPERATIONAL_STATUSES])}
          ariaLabel="Ver pedidos em andamento"
        />
        <StatCard
          label="Pedidos com pendência"
          value={m?.pedidosComPendencia ?? 0}
          icon={<AlertTriangle className="h-5 w-5" />}
          hint="Falta confirmar tamanho ou preço"
          loading={loading}
          onClick={() => goOrders([...OPERATIONAL_STATUSES])}
          ariaLabel="Ver pedidos com pendência"
        />
        <StatCard
          label="Pedidos hoje"
          value={m?.pedidosHoje ?? 0}
          icon={<ShoppingBag className="h-5 w-5" />}
          hint="Criados no dia atual"
          loading={loading}
          onClick={() => goOrders([])}
          ariaLabel="Ver pedidos"
        />
        <StatCard
          label="Pedidos em aberto"
          value={m?.pedidosEmAberto ?? 0}
          icon={<Clock className="h-5 w-5" />}
          hint="Ainda não finalizados nem cancelados"
          loading={loading}
          onClick={() => goOrders([...OPERATIONAL_STATUSES])}
          ariaLabel="Ver pedidos em aberto"
        />
        <StatCard
          label="Pedidos finalizados"
          value={m?.pedidosFinalizados ?? 0}
          icon={<CheckCircle2 className="h-5 w-5" />}
          hint="Concluídos com sucesso"
          loading={loading}
          onClick={() => goOrders(["finalizado"])}
          ariaLabel="Ver pedidos finalizados"
        />
        <StatCard
          label="Clientes"
          value={m?.clientes ?? 0}
          icon={<Users className="h-5 w-5" />}
          hint="Base consolidada por telefone"
          loading={loading}
          onClick={goClients}
          ariaLabel="Ver clientes"
        />
        <StatCard
          label="Produtos"
          value={m?.produtos ?? 0}
          icon={<Boxes className="h-5 w-5" />}
          hint="Itens publicáveis no catálogo"
          loading={loading}
          onClick={() => goStock("todos")}
          ariaLabel="Ver estoque"
        />
        <StatCard
          label="Estoque baixo"
          value={m?.estoqueBaixo ?? 0}
          icon={<PackageX className="h-5 w-5" />}
          trend={
            m && m.estoqueBaixo > 0
              ? { direction: "down", label: "Reposição sugerida" }
              : { direction: "flat", label: "Nenhum alerta" }
          }
          loading={loading}
          onClick={() => goStock("baixo")}
          ariaLabel="Ver itens com estoque baixo"
        />
        <StatCard
          label="Peças a conferir"
          value={m?.pendenciasEstoque ?? 0}
          icon={<AlertTriangle className="h-5 w-5" />}
          hint="Sem preço, tamanho ou conferência"
          loading={loading}
          onClick={() => goStock("todos")}
          ariaLabel="Ver conferência de estoque"
        />

        {m?.financeiroVisivel && (
          <>
            <StatCard
              label="Receita líquida (dia)"
              value={formatBRL(m.receitaLiquidaDia)}
              icon={<DollarSign className="h-5 w-5" />}
              hint="Financeiro: recebido − estornos"
              loading={loading}
            />
            <StatCard
              label="Receita líquida (mês)"
              value={formatBRL(m.receitaLiquidaMes)}
              icon={<Wallet className="h-5 w-5" />}
              hint="Acumulado do mês pelo financeiro"
              loading={loading}
            />
            <StatCard
              label="Ticket médio (mês)"
              value={formatBRL(m.ticketMedioMes)}
              icon={<TrendingUp className="h-5 w-5" />}
              hint={`${m.vendasMes} venda(s) no mês`}
              loading={loading}
            />
          </>
        )}
      </section>
    </PermissionGate>
  );
}
