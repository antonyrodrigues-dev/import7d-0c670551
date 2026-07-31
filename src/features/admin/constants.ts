/**
 * 7D IMPORTS — Constantes do módulo administrativo.
 *
 * Fonte única para nomes de rotas, status, papéis e permissões. Nenhum
 * componente pode duplicar essas strings.
 */

import type { AdminNavKey, EmployeeRole, OrderStatus, Permission } from "./types";

export const ADMIN_NAV: { key: AdminNavKey; label: string; path: string }[] = [
  { key: "dashboard", label: "Dashboard", path: "/admin" },
  { key: "atendimentos", label: "Atendimentos", path: "/admin/atendimentos" },
  { key: "pedidos", label: "Pedidos", path: "/admin/pedidos" },
  { key: "financeiro", label: "Financeiro", path: "/admin/financeiro" },
  { key: "estoque", label: "Estoque", path: "/admin/estoque" },
  { key: "clientes", label: "Clientes", path: "/admin/clientes" },
  { key: "funcionarios", label: "Funcionários", path: "/admin/funcionarios" },
  { key: "notificacoes", label: "Notificações", path: "/admin/notificacoes" },
  { key: "configuracoes", label: "Configurações", path: "/admin/configuracoes" },
  { key: "parametros", label: "Parâmetros", path: "/admin/configuracoes/operacao" },
];

export const ORDER_STATUSES: { key: OrderStatus; label: string }[] = [
  { key: "novo", label: "Novo" },
  { key: "pagamento_confirmado", label: "Pagamento confirmado" },
  { key: "separado", label: "Separado" },
  { key: "reservado", label: "Reservado" },
  { key: "aguardando_retirada", label: "Aguardando retirada" },
  { key: "enviado", label: "Enviado" },
  { key: "finalizado", label: "Finalizado" },
  { key: "cancelado", label: "Cancelado" },
];

export const EMPLOYEE_ROLES: { key: EmployeeRole; label: string }[] = [
  { key: "admin", label: "Administrador Master" },
  { key: "vendedor", label: "Vendedor" },
];

/** Matriz de permissões: fonte única de autorização. */
export const ROLE_PERMISSIONS: Record<EmployeeRole, Permission[]> = {
  admin: [
    "orders:view",
    "orders:edit",
    "inventory:view",
    "inventory:edit",
    "customers:view",
    "customers:edit",
    "employees:view",
    "employees:edit",
    "settings:view",
    "settings:edit",
    "notifications:view",
    "notifications:edit",
    "finance:view",
    "queue:view",
    "queue:manage",
    "params:view",
    "params:edit",
  ],
  vendedor: [
    "orders:view",
    "orders:edit",
    "inventory:view",
    "customers:view",
    "notifications:view",
    "queue:view",
  ],
};

/** Threshold para acionar alerta "estoque baixo". */
export const LOW_STOCK_THRESHOLD = 3;

/** Permissão exigida para exibir cada item do menu administrativo. */
export const ADMIN_NAV_PERMISSION: Record<AdminNavKey, Permission> = {
  dashboard: "orders:view",
  atendimentos: "queue:view",
  pedidos: "orders:view",
  financeiro: "finance:view",
  estoque: "inventory:view",
  clientes: "customers:view",
  funcionarios: "employees:view",
  notificacoes: "notifications:view",
  configuracoes: "settings:view",
  parametros: "params:edit",
};
