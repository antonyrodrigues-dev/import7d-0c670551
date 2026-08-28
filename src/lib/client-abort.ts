/**
 * 7D IMPORTS — Detecção de aborto real do cliente.
 *
 * Regra de ouro: só é "aborto" quando o socket/fetch foi cancelado pelo
 * navegador. Erro 500 real, erro de autorização, erro de banco ou erro de
 * lógica NUNCA podem ser silenciados por esta função.
 */

interface ErrorLike {
  code?: unknown;
  name?: unknown;
  message?: unknown;
  cause?: unknown;
}

export function isClientAbort(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const e = current as ErrorLike;
    if (e.code === "ECONNRESET" || e.name === "AbortError") return true;
    if (typeof e.message === "string" && e.message.trim() === "aborted") return true;
    current = e.cause;
  }
  return false;
}
