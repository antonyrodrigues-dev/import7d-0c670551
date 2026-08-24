/**
 * 7D IMPORTS — Modelo único de erro do painel administrativo.
 *
 * Todo Service deve lançar/repassar erros como `AdminError` e todo consumidor
 * (hook/UI) deve tratá-los via `handleAdminError`. Nenhum `throw new Error()`
 * genérico deve escapar de um Service.
 */

import { toast } from "sonner";
import { logger } from "./logger";
import type { IsoDateTime } from "../types";

export type AdminErrorCode =
  | "validation"
  | "not_found"
  | "conflict"
  | "permission"
  | "network"
  | "offline"
  | "rollback"
  | "unknown";

export interface AdminError {
  code: AdminErrorCode;
  message: string;
  origin: string;
  recoverable: boolean;
  timestamp: IsoDateTime;
  cause?: unknown;
}

export function createAdminError(
  code: AdminErrorCode,
  message: string,
  origin: string,
  options: { recoverable?: boolean; cause?: unknown } = {},
): AdminError {
  return {
    code,
    message,
    origin,
    recoverable: options.recoverable ?? true,
    timestamp: new Date().toISOString(),
    cause: options.cause,
  };
}

export function isAdminError(e: unknown): e is AdminError {
  return typeof e === "object" && e !== null && "code" in e && "origin" in e && "timestamp" in e;
}

/**
 * Traduz erros crus do banco (RPC/RLS/Postgres) para linguagem operacional.
 * Nenhum "Erro inesperado" deve chegar ao funcionário quando a causa é
 * conhecida — cada mensagem diz exatamente o que fazer em seguida.
 */
export function translateBackendError(raw: string): { code: AdminErrorCode; message: string } {
  const m = raw.toLowerCase();
  if (/pend[êe]ncia|sem pre[çc]o|sem tamanho|pendencia_/.test(m)) {
    return {
      code: "validation",
      message: "Confirme tamanho e preço da peça antes de avançar com o pagamento.",
    };
  }
  if (/transi[çc][ãa]o|status inv[áa]lido|n[ãa]o permitida/.test(m)) {
    return {
      code: "validation",
      message: "Esta etapa não é válida para o status atual do pedido. Recarregue e tente de novo.",
    };
  }
  if (/estoque|saldo|dispon[íi]vel|reserva/.test(m)) {
    return {
      code: "conflict",
      message: "Estoque insuficiente para esta peça. Confira a disponibilidade antes de seguir.",
    };
  }
  if (/permission|denied|restrit|acesso|rls|policy|admin master/.test(m)) {
    return {
      code: "permission",
      message: "Você não tem permissão para esta ação. Fale com o Administrador Master.",
    };
  }
  if (/pagamento/.test(m)) {
    return {
      code: "validation",
      message: "Operação de pagamento recusada pelo servidor. Verifique o estado do pedido.",
    };
  }
  if (/network|fetch|timeout|conex/.test(m)) {
    return { code: "network", message: "Sem conexão com o servidor. Tente novamente." };
  }
  return { code: "unknown", message: raw || "Não foi possível concluir a operação." };
}

export function toAdminError(e: unknown, origin: string): AdminError {
  if (isAdminError(e)) return e;
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const { code, message } = translateBackendError(raw);
  return createAdminError(code, message, origin, { cause: e });
}


/**
 * Trata um erro seguindo o pipeline oficial: log estruturado + toast + retorno.
 * Nunca escreve em `console.*` diretamente.
 */
export function handleAdminError(e: unknown, origin: string): AdminError {
  const err = toAdminError(e, origin);
  logger.error(err.message, { code: err.code, origin: err.origin, cause: err.cause });
  toast.error(err.message);
  return err;
}
