/**
 * 7D IMPORTS — Constantes do módulo administrativo.
 *
 * Fonte única para nomes de rotas, status, papéis e permissões. Nenhum
 * componente pode duplicar essas strings.
 */

import type { AdminNavKey, EmployeeRole, OrderStatus, Permission } from "./types";

export const ADMIN_NAV: { key: AdminNavKey; label: string; path: string }[] = [
  { key: "dashboard", label: "Dashboard", path: "/admin" },
  { key: "pedidos", label: "Pedidos", path: "/admin/pedidos" },
  { key: "estoque", label: "Estoque", path: "/admin/estoque" },
  { key: "clientes", label: "Clientes", path: "/admin/clientes" },
  { key: "funcionarios", label: "Funcionários", path: "/admin/funcionarios" },
  { key: "notificacoes", label: "Notificações", path: "/admin/notificacoes" },
  { key: "configuracoes", label: "Configurações", path: "/admin/configuracoes" },
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
  ],
  vendedor: ["orders:view", "orders:edit", "inventory:view", "customers:view"],
};

/** Threshold para acionar alerta "estoque baixo". */
export const LOW_STOCK_THRESHOLD = 3;

export const ADMIN_LOW_STOCK_LABEL = "Estoque baixo";