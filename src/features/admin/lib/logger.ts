/**
 * 7D IMPORTS — AdminLogger.
 *
 * Logger único de todos os Services administrativos. Escreve na store de
 * auditoria (`useLogsStore`) com categorização semântica.
 *
 * Regras:
 *   - Nenhum `console.log` / `console.error` espalhado pelo código.
 *   - Toda operação relevante (mutação, transição, erro, evento de segurança)
 *     passa por `logger.<categoria>()`.
 */

import { useLogsStore } from "../stores/logs";
import type { LogKind } from "../stores/logs";

export type LogCategory = "INFO" | "WARNING" | "ERROR" | "SECURITY" | "PERFORMANCE";

interface WriteMeta {
  category: LogCategory;
  kind?: LogKind;
  [k: string]: unknown;
}

function write(category: LogCategory, message: string, meta: Record<string, unknown> = {}) {
  const kind = (meta.kind as LogKind | undefined) ?? mapKind(category);
  const payload: WriteMeta = { category, ...meta };
  useLogsStore.getState().push(kind, message, payload);
}

function mapKind(c: LogCategory): LogKind {
  switch (c) {
    case "ERROR":
      return "system.error";
    case "SECURITY":
      return "auth.login";
    default:
      return "system.error";
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write("INFO", message, meta ?? {}),
  warn: (message: string, meta?: Record<string, unknown>) => write("WARNING", message, meta ?? {}),
  error: (message: string, meta?: Record<string, unknown>) => write("ERROR", message, meta ?? {}),
  security: (message: string, meta?: Record<string, unknown>) =>
    write("SECURITY", message, meta ?? {}),
  performance: (message: string, meta?: Record<string, unknown>) =>
    write("PERFORMANCE", message, meta ?? {}),
};

export type AdminLogger = typeof logger;