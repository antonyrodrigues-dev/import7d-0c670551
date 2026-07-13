import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, MoreHorizontal, Plus, ShieldCheck, Trash2, UserCog, Users, UserX } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ErrorState, Skeleton } from "@/features/admin/components/PageHeader";
import { EmptyState } from "@/features/admin/components/AdminUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMPLOYEE_ROLES } from "@/features/admin/constants";
import { useEmployees, usePermissions } from "@/features/admin/hooks";
import type { Employee, EmployeeRole } from "@/features/admin/types";
import {
  addEmployeeByEmail,
  changeEmployeeRole,
  removeEmployee,
  setEmployeeStatus,
} from "@/features/admin/services/employees.functions";
import { formatPhoneBR, digitsOnly } from "@/lib/masks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [addOpen, setAddOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    | { kind: "deactivate" | "activate" | "remove"; emp: Employee }
    | null
  >(null);
  const [busy, setBusy] = useState(false);

  const runAction = async () => {
    if (!confirmAction) return;
    setBusy(true);
    try {
      if (confirmAction.kind === "remove") {
        await removeEmployee({ data: { userId: confirmAction.emp.id } });
        toast.success("Funcionário removido do painel.");
      } else {
        await setEmployeeStatus({
          data: {
            userId: confirmAction.emp.id,
            status: confirmAction.kind === "deactivate" ? "inativo" : "ativo",
          },
        });
        toast.success(
          confirmAction.kind === "deactivate" ? "Funcionário desativado." : "Funcionário reativado.",
        );
      }
      await refresh();
      setConfirmAction(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onChangeRole = async (emp: Employee, role: EmployeeRole) => {
    if (emp.role === role) return;
    try {
      await changeEmployeeRole({ data: { userId: emp.id, role } });
      toast.success("Cargo atualizado.");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          eyebrow="Painel"
          title="Funcionários"
          description="Equipe autorizada a operar o painel. Permissões são herdadas do papel."
        />
        {can("employees:edit") && (
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Adicionar funcionário
          </Button>
        )}
      </div>

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
            <EmployeesTable
              employees={employees}
              canEdit={can("employees:edit")}
              onChangeRole={onChangeRole}
              onConfirm={setConfirmAction}
            />
          ))}
      </section>

      <AddEmployeeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => {
          setAddOpen(false);
          void refresh();
        }}
      />

      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(o) => !o && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.kind === "remove"
                ? "Remover funcionário?"
                : confirmAction?.kind === "deactivate"
                  ? "Desativar acesso?"
                  : "Reativar acesso?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.kind === "remove"
                ? "O funcionário perde acesso ao painel imediatamente. A conta permanece cadastrada."
                : confirmAction?.kind === "deactivate"
                  ? "O funcionário deixa de conseguir operar o painel até ser reativado."
                  : "O funcionário volta a poder operar o painel."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={runAction}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EmployeesTable({
  employees,
  canEdit,
  onChangeRole,
  onConfirm,
}: {
  employees: Employee[];
  canEdit: boolean;
  onChangeRole: (emp: Employee, role: EmployeeRole) => void | Promise<void>;
  onConfirm: (
    action: { kind: "deactivate" | "activate" | "remove"; emp: Employee },
  ) => void;
}) {
  return (
    <div className="overflow-x-auto border border-[color:var(--border)] bg-white">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-[color:var(--cream-deep)]/60 text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
          <tr>
            <th className="px-4 py-3 text-left">Pessoa</th>
            <th className="px-4 py-3 text-left">Contato</th>
            <th className="px-4 py-3 text-left">Papel</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Último acesso</th>
            <th className="px-4 py-3 text-left">Cadastrado em</th>
            {canEdit && <th className="px-4 py-3 text-right">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id} className="border-t border-[color:var(--border)] align-top">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={e.nome || e.login} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[color:var(--forest-deep)]">
                      {e.nome || "—"}
                    </p>
                    <p className="text-[10px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                      {e.id.slice(0, 8)}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
                {e.login && digitsOnly(e.login).length >= 10
                  ? formatPhoneBR(e.login)
                  : e.email ?? "—"}
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
              {canEdit && (
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label="Ações"
                        className="rounded p-1 hover:bg-[color:var(--cream)]"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onChangeRole(e, e.role === "admin" ? "vendedor" : "admin")}
                      >
                        <UserCog className="mr-2 h-4 w-4" />
                        {e.role === "admin"
                          ? "Tornar Vendedor"
                          : "Promover a Admin Master"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {e.status === "ativo" ? (
                        <DropdownMenuItem
                          onClick={() => onConfirm({ kind: "deactivate", emp: e })}
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          Desativar
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => onConfirm({ kind: "activate", emp: e })}
                        >
                          <UserCog className="mr-2 h-4 w-4" />
                          Reativar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-700"
                        onClick={() => onConfirm({ kind: "remove", emp: e })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remover do painel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "•";
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      aria-hidden="true"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--cream-deep)] text-[11px] font-semibold tracking-luxe uppercase text-[color:var(--forest-deep)]"
    >
      {initialsOf(name)}
    </div>
  );
}

function AddEmployeeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [role, setRole] = useState<EmployeeRole>("vendedor");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await addEmployeeByEmail({
        data: {
          email: email.trim(),
          nome: nome.trim() || undefined,
          telefone: digitsOnly(telefone) || undefined,
          role,
        },
      });
      toast.success("Funcionário adicionado.");
      setEmail("");
      setNome("");
      setTelefone("");
      setRole("vendedor");
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar funcionário</DialogTitle>
          <DialogDescription>
            Informe o email de uma pessoa <strong>já cadastrada</strong> na loja. O acesso ao painel
            será concedido imediatamente com o cargo escolhido.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[11px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Email
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="funcionario@exemplo.com"
              autoComplete="email"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Nome
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            WhatsApp
            <Input
              value={formatPhoneBR(telefone)}
              onChange={(e) => setTelefone(digitsOnly(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
            Cargo
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as EmployeeRole)}
              className="h-9 border border-[color:var(--border)] bg-white px-2 text-sm text-[color:var(--forest-deep)]"
            >
              {EMPLOYEE_ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={busy || !email.trim()} onClick={submit}>
            {busy ? "Adicionando…" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// (Tabela desmembrada acima; corpo anterior removido.)
function LegacyRows_OBSOLETE() {
  return null;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unused = LegacyRows_OBSOLETE;
function _unusedTableShim() {
  return (
    <table>
      <tbody>
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