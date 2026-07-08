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
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    "origin" in e &&
    "timestamp" in e
  );
}

export function toAdminError(e: unknown, origin: string): AdminError {
  if (isAdminError(e)) return e;
  const message = e instanceof Error ? e.message : "Erro inesperado.";
  const code: AdminErrorCode = /network|fetch|failed to fetch/i.test(message)
    ? "network"
    : "unknown";
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