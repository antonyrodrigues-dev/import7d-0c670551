import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState, ErrorState, Skeleton } from "@/features/admin/components/PageHeader";
import { EMPLOYEE_ROLES, ROLE_PERMISSIONS } from "@/features/admin/constants";
import { useEmployees, usePermissions } from "@/features/admin/hooks";

export const Route = createFileRoute("/_authenticated/admin/funcionarios")({
  head: () => ({
    meta: [{ title: "Funcionários — 7D IMPORTS" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: FuncionariosPage,
});

function FuncionariosPage() {
  const { employees, state, error, refresh } = useEmployees();
  const { can, isAdmin } = usePermissions();

  if (!can("employees:view")) {
    return (
      <>
        <PageHeader eyebrow="Painel" title="Funcionários" />
        <EmptyState
          title="Acesso restrito"
          description="Apenas Administradores Master podem gerenciar funcionários."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Painel" title="Funcionários" description="Papéis e permissões da equipe." />
      <section aria-label="Papéis" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {EMPLOYEE_ROLES.map((r) => (
          <div key={r.key} className="border border-[color:var(--border)] bg-[color:var(--cream)] p-5">
            <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">Papel</p>
            <p className="mt-2 font-display text-2xl text-[color:var(--forest-deep)]">{r.label}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {ROLE_PERMISSIONS[r.key].map((p) => (
                <li
                  key={p}
                  className="border border-[color:var(--border)] px-2 py-1 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]"
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {state === "error" && <ErrorState message={error ?? "Falha ao carregar."} onRetry={refresh} />}
      {state === "loading" && <Skeleton className="h-40 w-full" />}

      {state === "ready" && (
        employees.length === 0 ? (
          <EmptyState title="Sem funcionários cadastrados" description="Adicione papéis na tabela user_roles." />
        ) : (
          <div className="overflow-x-auto border border-[color:var(--border)]">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[color:var(--cream-deep)]/60 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Papel</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-t border-[color:var(--border)]">
                    <td className="px-4 py-3 tabular-nums">{e.id}</td>
                    <td className="px-4 py-3 text-[10px] tracking-luxe uppercase">
                      {EMPLOYEE_ROLES.find((r) => r.key === e.role)?.label ?? e.role}
                    </td>
                    <td className="px-4 py-3 text-[10px] tracking-luxe uppercase">
                      {e.ativo ? "Ativo" : "Inativo"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {!isAdmin && (
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          Sua sessão não é master — a edição de papéis fica desabilitada.
        </p>
      )}
    </>
  );
}