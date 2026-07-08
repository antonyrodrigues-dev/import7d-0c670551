import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock,
  DollarSign,
  PackageX,
  ShoppingBag,
  Timer,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { StatCard } from "@/features/admin/components/StatCard";
import { formatBRL } from "@/data/products";
import {
  useOrders,
  useInventory,
  useCustomers,
  useDashboard,
} from "@/features/admin/hooks";
import { useReserva } from "@/store/reserva";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [{ title: "Dashboard — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  // Fluxo obrigatório: hooks disparam os fetches; useDashboard alimenta a
  // store única de métricas; os cards apenas consomem.
  const { state: ordersState } = useOrders();
  useInventory();
  useCustomers();
  const { metrics: m } = useDashboard();

  const reservaItems = useReserva((s) => s.items);
  const loading = ordersState === "loading" || !m;

  return (
    <>
      <PageHeader
        eyebrow="Painel"
        title="Dashboard"
        description="Visão consolidada dos pedidos, estoque e reservas em andamento."
      />
      <section
        aria-label="Indicadores"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <StatCard
          label="Pedidos hoje"
          value={m?.pedidosHoje ?? 0}
          icon={<ShoppingBag className="h-5 w-5" />}
          hint="Pedidos criados no dia atual"
          loading={loading}
        />
        <StatCard
          label="Pedidos pendentes"
          value={m?.pedidosPendentes ?? 0}
          icon={<Clock className="h-5 w-5" />}
          hint="Aguardando separação, retirada ou envio"
          loading={loading}
        />
        <StatCard
          label="Pedidos finalizados"
          value={m?.pedidosFinalizados ?? 0}
          icon={<CheckCircle2 className="h-5 w-5" />}
          hint="Concluídos com sucesso"
          loading={loading}
        />
        <StatCard
          label="Clientes"
          value={m?.clientes ?? 0}
          icon={<Users className="h-5 w-5" />}
          hint="Base derivada dos pedidos"
          loading={loading}
        />
        <StatCard
          label="Produtos"
          value={m?.produtos ?? 0}
          icon={<Boxes className="h-5 w-5" />}
          hint="Itens cadastrados no catálogo"
          loading={loading}
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
        />
        <StatCard
          label="Reserva em andamento"
          value={reservaItems.length}
          icon={<ClipboardList className="h-5 w-5" />}
          hint="Itens em rascunho de reserva"
        />
        <StatCard
          label="Ticket médio"
          value={formatBRL(m?.ticketMedio ?? 0)}
          icon={<TrendingUp className="h-5 w-5" />}
          hint="Valor médio por pedido concluído"
          loading={loading}
        />
        <StatCard
          label="Faturamento do dia"
          value={formatBRL(m?.faturamentoDia ?? 0)}
          icon={<DollarSign className="h-5 w-5" />}
          hint="Pedidos concluídos hoje"
          loading={loading}
        />
        <StatCard
          label="Faturamento do mês"
          value={formatBRL(m?.faturamentoMes ?? 0)}
          icon={<Wallet className="h-5 w-5" />}
          hint="Acumulado no mês corrente"
          loading={loading}
        />
        <StatCard
          label="Tempo médio"
          value="—"
          icon={<Timer className="h-5 w-5" />}
          hint="Aguardando amostragem suficiente"
          loading={loading}
        />
      </section>
    </>
  );
}
