import { createFileRoute } from "@tanstack/react-router";
import { Lock, ShieldCheck, Users } from "lucide-react";
import { PageHeader, ErrorState, Skeleton } from "@/features/admin/components/PageHeader";
import { EmptyState } from "@/features/admin/components/AdminUI";
import { EMPLOYEE_ROLES } from "@/features/admin/constants";
import { useEmployees, usePermissions } from "@/features/admin/hooks";
import type { Employee, EmployeeRole } from "@/features/admin/types";

export const Route = createFileRoute("/_authenticated/admin/funcionarios")({
  head: () => ({
    meta: [
      { title: "Funcionários — 7D IMPORTS" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: FuncionariosPage,
});

/**
 * O painel exibe funcionários como *pessoas*, não como matrizes de checkboxes.
 * Toda autorização é herdada da Role (Admin Master ou Vendedor); exceções
 * ficam dentro de `ROLE_PERMISSIONS`, longe da UI.
 */

const ROLE_SUMMARY: Record<EmployeeRole, { label: string; description: string; access: string[] }> = {
  admin: {
    label: "Administrador Master",
    description: "Acesso total. Único papel que edita Configurações e Funcionários.",
    access: [
      "Pedidos",
      "Estoque",
      "Clientes",
      "Notificações",
      "Configurações",
      "Funcionários",
      "Financeiro",
    ],
  },
  vendedor: {
    label: "Vendedor",
    description: "Operação diária. Sem acesso a Configurações, Funcionários ou Financeiro.",
    access: ["Pedidos", "Estoque", "Clientes", "Notificações"],
  },
};

function FuncionariosPage() {
  const { employees, state, error, refresh } = useEmployees();
  const { can } = usePermissions();

  if (!can("employees:view")) {
    return (
      <>
        <PageHeader eyebrow="Painel" title="Funcionários" />
        <EmptyState
          icon={<Lock className="h-5 w-5" />}
          title="Acesso restrito"
          description="Apenas Administradores Master podem gerenciar funcionários."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Painel"
        title="Funcionários"
        description="Equipe autorizada a operar o painel. Permissões são herdadas do papel."
      />

      {/* Cards de papéis — explicam o modelo antes de listar as pessoas. */}
      <section
        aria-label="Papéis disponíveis"
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        {EMPLOYEE_ROLES.map((r) => {
          const s = ROLE_SUMMARY[r.key];
          return (
            <article
              key={r.key}
              className="border border-[color:var(--border)] bg-[color:var(--cream)] p-5"
            >
              <div className="flex items-center gap-2 text-[color:var(--gold)]">
                <ShieldCheck className="h-4 w-4" />
                <p className="text-[10px] tracking-luxe uppercase">Papel</p>
              </div>
              <p className="mt-2 font-display text-2xl text-[color:var(--forest-deep)]">
                {s.label}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                {s.description}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {s.access.map((p) => (
                  <li
                    key={p}
                    className="border border-[color:var(--border)] bg-white px-2 py-1 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>

      <section aria-label="Pessoas" className="mt-6 flex flex-col gap-3">
        <header className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[color:var(--gold)]" />
          <h2 className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Pessoas com acesso
          </h2>
        </header>

        {state === "error" && (
          <ErrorState message={error ?? "Falha ao carregar."} onRetry={refresh} />
        )}
        {state === "loading" && <Skeleton className="h-40 w-full" />}

        {state === "ready" &&
          (employees.length === 0 ? (
            <EmptyState
              title="Sem funcionários cadastrados"
              description="Novos acessos serão listados aqui após o cadastro em user_roles."
            />
          ) : (
            <EmployeesTable employees={employees} />
          ))}
      </section>
    </>
  );
}

function EmployeesTable({ employees }: { employees: Employee[] }) {
  return (
    <div className="overflow-x-auto border border-[color:var(--border)] bg-white">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-[color:var(--cream-deep)]/60 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          <tr>
            <th className="px-4 py-3 text-left">Nome</th>
            <th className="px-4 py-3 text-left">Contato</th>
            <th className="px-4 py-3 text-left">Papel</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Último acesso</th>
            <th className="px-4 py-3 text-left">Cadastrado em</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id} className="border-t border-[color:var(--border)] align-top">
              <td className="px-4 py-3">
                <p className="font-medium text-[color:var(--forest-deep)]">{e.nome}</p>
                <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                  {e.login}
                </p>
              </td>
              <td className="px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
                {e.email ?? "—"}
              </td>
              <td className="px-4 py-3 text-[10px] tracking-luxe uppercase text-[color:var(--forest-deep)]">
                {ROLE_SUMMARY[e.role]?.label ?? e.role}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] tracking-luxe uppercase ${
                    e.status === "ativo"
                      ? "border-emerald-600/40 bg-emerald-50 text-emerald-700"
                      : "border-[color:var(--border)] bg-[color:var(--cream)] text-[color:var(--muted-foreground)]"
                  }`}
                >
                  {e.status === "ativo" ? "Ativo" : "Inativo"}
                </span>
              </td>
              <td className="px-4 py-3 text-xs tabular-nums text-[color:var(--muted-foreground)]">
                {e.ultimoAcesso ? formatDate(e.ultimoAcesso) : "—"}
              </td>
              <td className="px-4 py-3 text-xs tabular-nums text-[color:var(--muted-foreground)]">
                {formatDate(e.criadoEm)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}