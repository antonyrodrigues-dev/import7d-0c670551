/**
 * 7D IMPORTS — Guarda de configuração do cliente.
 *
 * O navegador só pode receber chave apropriada para cliente (publishable/anon).
 * Se alguém publicar por engano uma chave secreta (`sb_secret_*` ou
 * `service_role`), a aplicação falha imediatamente com erro de configuração —
 * nunca "funciona errado" expondo privilégio administrativo.
 */

const SECRET_PREFIXES = ["sb_secret_", "sbp_", "service_role"];

export function assertBrowserKeyIsPublic(key: string | undefined): void {
  if (!key) return;
  const lower = key.toLowerCase();
  const looksSecret =
    SECRET_PREFIXES.some((p) => lower.startsWith(p)) || lower.includes("service_role");
  if (looksSecret) {
    throw new Error(
      "Configuração inválida: chave secreta detectada no cliente. Use a chave publicável (anon).",
    );
  }
}

/** Executa a checagem com a variável pública do build. */
export function guardClientEnv(): void {
  assertBrowserKeyIsPublic(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined);
}
