/** Estados assíncronos compartilhados por todas as stores do admin. */
export type AsyncState = "idle" | "loading" | "ready" | "error";

export type AdminNavKey =
  | "dashboard"
  | "pedidos"
  | "estoque"
  | "clientes"
  | "funcionarios"
  | "configuracoes"
  | "notificacoes";

export type Permission =
  | "orders:view"
  | "orders:edit"
  | "inventory:view"
  | "inventory:edit"
  | "customers:view"
  | "customers:edit"
  | "employees:view"
  | "employees:edit"
  | "settings:view"
  | "settings:edit"
  | "notifications:view"
  | "notifications:edit";

/** ISO 8601 datetime — usado em toda a base administrativa. */
export type IsoDateTime = string;