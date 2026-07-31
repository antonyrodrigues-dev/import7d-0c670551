/**
 * Estados assíncronos compartilhados por TODAS as stores do admin.
 * Nenhum módulo pode definir estados próprios diferentes desta união.
 *
 * - `idle`     — ainda não iniciou
 * - `loading`  — carregando dados
 * - `saving`   — persistindo mutação
 * - `success`  — última operação concluída
 * - `ready`    — dados carregados e prontos para leitura
 * - `empty`    — sem registros
 * - `error`    — falha na última operação
 * - `offline`  — sem conexão
 */
export type AdminAsyncState =
  | "idle"
  | "loading"
  | "saving"
  | "success"
  | "ready"
  | "empty"
  | "error"
  | "offline";

/** @deprecated Use `AdminAsyncState`. Mantido apenas por compatibilidade. */
export type AsyncState = AdminAsyncState;

export type AdminNavKey =
  | "dashboard"
  | "atendimentos"
  | "pedidos"
  | "financeiro"
  | "estoque"
  | "clientes"
  | "funcionarios"
  | "configuracoes"
  | "parametros"
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
  | "notifications:edit"
  | "finance:view"
  | "queue:view"
  | "queue:manage"
  | "params:view"
  | "params:edit";

/** ISO 8601 datetime — usado em toda a base administrativa. */
export type IsoDateTime = string;
