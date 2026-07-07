import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { StatCard } from "@/features/admin/components/StatCard";
import { formatBRL } from "@/data/products";
import { useOrdersStore } from "@/features/admin/stores/orders";
import { useInventoryStore } from "@/features/admin/stores/inventory";
import { useCustomersStore } from "@/features/admin/stores/customers";
import { useDashboardStore } from "@/features/admin/stores/dashboard";
import { deriveCustomersFromOrders } from "@/features/admin/services/customers.service";
import { buildDashboardMetrics } from "@/features/admin/services/dashboard.service";
import { useReserva } from "@/store/reserva";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [{ title: "Dashboard — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const orders = useOrdersStore((s) => s.orders);
  const ordersState = useOrdersStore((s) => s.state);
  const refreshOrders = useOrdersStore((s) => s.refresh);
  const inventory = useInventoryStore((s) => s.items);
  const refreshInventory = useInventoryStore((s) => s.refresh);
  const setCustomers = useCustomersStore((s) => s.set);
  const dashboard = useDashboardStore();
  const reservaItems = useReserva((s) => s.items);

  useEffect(() => {
    void refreshOrders();
    void refreshInventory();
  }, [refreshOrders, refreshInventory]);

  useEffect(() => {
    const customers = deriveCustomersFromOrders(orders);
    setCustomers(customers);
    dashboard.set(buildDashboardMetrics(orders, inventory, customers.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, inventory]);

  const m = dashboard.metrics;
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
        <StatCard label="Pedidos hoje" value={m?.pedidosHoje ?? 0} loading={loading} />
        <StatCard label="Pedidos pendentes" value={m?.pedidosPendentes ?? 0} loading={loading} />
        <StatCard label="Pedidos finalizados" value={m?.pedidosFinalizados ?? 0} loading={loading} />
        <StatCard label="Clientes" value={m?.clientes ?? 0} loading={loading} />
        <StatCard label="Produtos" value={m?.produtos ?? 0} loading={loading} />
        <StatCard label="Estoque baixo" value={m?.estoqueBaixo ?? 0} loading={loading} />
        <StatCard label="Reserva em andamento" value={reservaItems.length} />
        <StatCard
          label="Ticket médio"
          value={formatBRL(m?.ticketMedio ?? 0)}
          loading={loading}
        />
        <StatCard
          label="Faturamento do dia"
          value={formatBRL(m?.faturamentoDia ?? 0)}
          loading={loading}
        />
        <StatCard
          label="Faturamento do mês"
          value={formatBRL(m?.faturamentoMes ?? 0)}
          loading={loading}
        />
      </section>
    </>
  );
}