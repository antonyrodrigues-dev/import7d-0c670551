import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CheckCircle2,
  DollarSign,
  LineChart as LineIcon,
  Percent,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { StatCard } from "@/features/admin/components/StatCard";
import { PermissionGate } from "@/features/admin/components/PermissionGate";
import { formatBRL } from "@/features/catalog";
import { useFinance, useOrders } from "@/features/admin/hooks";
import type { FinancePeriod } from "@/features/admin/types";

export const Route = createFileRoute("/_authenticated/admin/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — 7D IMPORTS" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: FinanceiroPage,
});

const PERIODS: { key: FinancePeriod; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "ano", label: "Este ano" },
  { key: "todos", label: "Histórico" },
];

function FinanceiroPage() {
  // Carrega pedidos (fonte única). Sem consulta paralela ao banco.
  const { state } = useOrders();
  const { metrics: m, period, setPeriod } = useFinance();
  const loading = state === "loading" || !m;

  return (
    <PermissionGate perm="finance:view" title="Financeiro">
      <PageHeader
        eyebrow="Painel"
        title="Financeiro"
        description="Receita, ticket médio, cancelamentos e rankings — derivados dos pedidos finalizados."
      />

      <nav className="flex flex-wrap gap-2" aria-label="Filtro de período">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={`h-10 border px-4 text-[11px] tracking-luxe uppercase transition-colors ${
              period === p.key
                ? "border-[color:var(--forest-deep)] bg-[color:var(--forest-deep)] text-[color:var(--cream)]"
                : "border-[color:var(--border)] text-[color:var(--forest-deep)] hover:border-[color:var(--forest-deep)]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </nav>

      <section
        aria-label="Indicadores executivos"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <StatCard
          label="Receita do dia"
          value={formatBRL(m?.receitaDia ?? 0)}
          icon={<DollarSign className="h-5 w-5" />}
          hint="Pedidos finalizados hoje"
          loading={loading}
        />
        <StatCard
          label="Receita do mês"
          value={formatBRL(m?.receitaMes ?? 0)}
          icon={<Wallet className="h-5 w-5" />}
          hint="Mês corrente"
          loading={loading}
        />
        <StatCard
          label="Receita do ano"
          value={formatBRL(m?.receitaAno ?? 0)}
          icon={<LineIcon className="h-5 w-5" />}
          hint={`${new Date().getFullYear()}`}
          loading={loading}
        />
        <StatCard
          label="Ticket médio"
          value={formatBRL(m?.ticketMedioPeriodo ?? 0)}
          icon={<TrendingUp className="h-5 w-5" />}
          hint="Média no período"
          loading={loading}
        />
        <StatCard
          label="Pedidos finalizados"
          value={m?.pedidosFinalizados ?? 0}
          icon={<CheckCircle2 className="h-5 w-5" />}
          hint="Concluídos no período"
          loading={loading}
        />
        <StatCard
          label="Pedidos cancelados"
          value={m?.pedidosCancelados ?? 0}
          icon={<XCircle className="h-5 w-5" />}
          hint="Cancelados no período"
          loading={loading}
        />
        <StatCard
          label="Taxa de cancelamento"
          value={`${(m?.taxaCancelamentoPct ?? 0).toFixed(1)}%`}
          icon={<Percent className="h-5 w-5" />}
          hint="Cancelados / decisões totais"
          loading={loading}
        />
        <StatCard
          label="Receita do período"
          value={formatBRL(m?.receitaPeriodo ?? 0)}
          icon={<DollarSign className="h-5 w-5" />}
          hint="Somatório no filtro atual"
          loading={loading}
        />
      </section>

      {m && m.series.length > 0 && (
        <section
          aria-label="Faturamento por dia"
          className="border border-[color:var(--border)] bg-[color:var(--cream)] p-5"
        >
          <header className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl text-[color:var(--forest-deep)]">
              Faturamento por dia
            </h2>
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              Receita × pedidos
            </p>
          </header>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={m.series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => formatBRL(v)}
                  width={80}
                />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, name) =>
                    name === "Receita"
                      ? [formatBRL(Number(value)), name]
                      : [value, name]
                  }
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="receita"
                  name="Receita"
                  stroke="var(--gold)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="pedidos"
                  name="Pedidos"
                  stroke="var(--forest-deep)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="border border-[color:var(--border)] bg-[color:var(--cream)] p-5">
          <header className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl text-[color:var(--forest-deep)]">
              Produtos mais vendidos
            </h2>
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              Top 5 por receita
            </p>
          </header>
          {m && m.topProdutos.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.topProdutos} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => formatBRL(v)}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip formatter={(value: number) => formatBRL(value)} />
                  <Bar dataKey="receita" name="Receita" fill="var(--gold)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[color:var(--muted-foreground)]">
              Sem vendas no período.
            </p>
          )}
        </div>

        <div className="border border-[color:var(--border)] bg-[color:var(--cream)] p-5">
          <header className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl text-[color:var(--forest-deep)]">
              Ranking de atendentes
            </h2>
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
              Por receita finalizada
            </p>
          </header>
          {m && m.topAtendentes.length > 0 ? (
            <ul className="divide-y divide-[color:var(--border)]">
              {m.topAtendentes.map((a, i) => (
                <li
                  key={a.nome}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-[color:var(--border)] text-[11px] font-semibold tabular-nums text-[color:var(--forest-deep)]">
                      {i + 1}
                    </span>
                    <p className="truncate text-sm text-[color:var(--forest-deep)]">
                      {a.nome}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-[color:var(--forest-deep)]">
                      {formatBRL(a.receita)}
                    </p>
                    <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                      {a.pedidos} pedidos
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-[color:var(--muted-foreground)]">
              Ainda sem pedidos atribuídos.
            </p>
          )}
        </div>
      </section>

      {m && m.pagamentos.length > 0 && (
        <section
          aria-label="Pagamentos"
          className="border border-[color:var(--border)] bg-[color:var(--cream)] p-5"
        >
          <header className="mb-4">
            <h2 className="font-display text-xl text-[color:var(--forest-deep)]">
              Formas de pagamento
            </h2>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-luxe text-[color:var(--muted-foreground)]">
                <tr className="border-b border-[color:var(--border)]">
                  <th className="py-2 pr-4 text-left">Método</th>
                  <th className="py-2 pr-4 text-right">Pedidos</th>
                  <th className="py-2 text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {m.pagamentos.map((p) => (
                  <tr key={p.metodo} className="border-b border-[color:var(--border)]">
                    <td className="py-2 pr-4">{p.metodo}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p.pedidos}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatBRL(p.receita)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </PermissionGate>
  );
}