import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Menu, X, LogOut, Bell, ChevronDown, KeyRound, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_NAV } from "../constants";
import { usePermissions, useAdminNotifications } from "../hooks";
import { InitialsAvatar } from "../components/AdminUI";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EMPLOYEE_ROLES } from "../constants";
import { auditAdminArchitecture } from "../lib/audit";

/**
 * Shell administrativo — sidebar fixa em desktop, drawer em mobile.
 * Todas as rotas filhas de `/admin` renderizam via `<Outlet />`. Nenhum
 * componente público é reutilizado; a UI é isolada mas mantém o design
 * system (cream / forest / gold).
 */
export function AdminShell() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { roles, reset: resetPerms, userId } = usePermissions();
  const { notifications } = useAdminNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    // Smoke test da arquitetura no boot do painel.
    auditAdminArchitecture();
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const u = data.user;
      if (!u) return;
      const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
      setUserName(meta.full_name ?? meta.name ?? "");
      setUserEmail(u.email ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const active = useMemo(() => {
    // Longest matching path wins so "/admin" doesn't shadow "/admin/pedidos".
    return ADMIN_NAV
      .filter((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
      .sort((a, b) => b.path.length - a.path.length)[0];
  }, [pathname]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Não foi possível encerrar a sessão. Tente novamente.");
      return;
    }
    resetPerms();
    toast.success("Sessão encerrada.");
    navigate({ to: "/auth", replace: true });
  };

  const displayName = userName || userEmail || "Sessão";
  const roleLabel =
    EMPLOYEE_ROLES.find((r) => roles.includes(r.key))?.label ??
    (roles[0] ?? "Sem cargo");

  return (
    <div className="flex min-h-dvh bg-[color:var(--cream)] text-[color:var(--forest-deep)]">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-[color:var(--border)] md:bg-[color:var(--cream-deep)]/40">
        <SidebarBody />
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-[color:var(--forest-deep)]/40 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu administrativo"
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[color:var(--cream)] shadow-2xl md:hidden"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
              <p className="font-display text-lg">Painel</p>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar menu"
                className="flex h-10 w-10 items-center justify-center"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <SidebarBody />
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[color:var(--border)] bg-[color:var(--cream)] px-4 md:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
              className="flex h-10 w-10 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] md:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <nav aria-label="breadcrumb" className="min-w-0 text-[11px] tracking-luxe uppercase">
              <ol className="flex items-center gap-2 text-[color:var(--muted-foreground)]">
                <li>Painel</li>
                {active && (
                  <>
                    <li aria-hidden="true">·</li>
                    <li className="truncate text-[color:var(--forest-deep)]">{active.label}</li>
                  </>
                )}
              </ol>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/notificacoes"
              aria-label={`Notificações (${unread} não lidas)`}
              className="relative flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-[color:var(--cream-deep)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--gold)] px-1 text-[9px] font-bold text-[color:var(--forest-deep)]">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Menu do usuário — ${displayName}`}
                  className="flex h-10 items-center gap-2 border border-[color:var(--border)] bg-[color:var(--cream)] pl-1 pr-2 transition-colors hover:border-[color:var(--forest-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                >
                  <InitialsAvatar name={displayName} size={32} />
                  <div className="hidden text-left md:block">
                    <p className="max-w-[160px] truncate text-[11px] font-semibold leading-tight text-[color:var(--forest-deep)]">
                      {displayName}
                    </p>
                    <p className="text-[9px] tracking-luxe uppercase text-[color:var(--muted-foreground)]">
                      {roleLabel}
                    </p>
                  </div>
                  <ChevronDown
                    className="h-4 w-4 text-[color:var(--muted-foreground)]"
                    aria-hidden="true"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">{displayName}</span>
                  {userEmail && userEmail !== displayName && (
                    <span className="truncate text-xs font-normal text-[color:var(--muted-foreground)]">
                      {userEmail}
                    </span>
                  )}
                  <span className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">
                    {roleLabel}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin/perfil" className="flex items-center gap-2">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    Meu perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/admin/perfil"
                    search={{ tab: "senha" }}
                    className="flex items-center gap-2"
                  >
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    Alterar senha
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    void signOut();
                  }}
                  className="text-[color:var(--destructive)] focus:text-[color:var(--destructive)]"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 py-8 md:px-8">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarBody() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-[color:var(--border)] px-6 py-6">
        <p className="text-[10px] tracking-luxe uppercase text-[color:var(--gold)]">7D IMPORTS</p>
        <p className="mt-2 font-display text-2xl text-[color:var(--forest-deep)]">Painel</p>
      </div>
      <nav aria-label="Navegação administrativa" className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-1">
          {ADMIN_NAV.map((item) => {
            const isActive =
              pathname === item.path ||
              (item.path !== "/admin" && pathname.startsWith(`${item.path}/`));
            return (
              <li key={item.key}>
                <Link
                  to={item.path}
                  activeOptions={{ exact: item.path === "/admin" }}
                  className={`flex h-11 items-center border-l-2 px-4 text-[11px] tracking-luxe uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ring)] ${
                    isActive
                      ? "border-[color:var(--gold)] bg-[color:var(--cream)] text-[color:var(--forest-deep)]"
                      : "border-transparent text-[color:var(--muted-foreground)] hover:border-[color:var(--gold)] hover:text-[color:var(--forest-deep)]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}