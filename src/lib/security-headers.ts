/**
 * 7D IMPORTS — Cabeçalhos de segurança aplicados a toda resposta HTML.
 *
 * Escopo consciente: a vitrine consome fontes Google, imagens de storage e
 * WebSocket do backend; o editor/preview embute a aplicação em iframe. A
 * política abaixo fecha o que dá para fechar sem quebrar esses caminhos.
 */

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self' https://*.lovable.app https://*.lovable.dev https://lovable.dev",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' https://cdn.gpteng.co",
  "connect-src 'self' https: wss:",
  "media-src 'self' https: blob:",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const HEADERS: Record<string, string> = {
  "content-security-policy": CSP,
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "cross-origin-opener-policy": "same-origin-allow-popups",
};

/** Devolve a resposta com os cabeçalhos de segurança aplicados (HTML apenas). */
export function withSecurityHeaders(response: Response): Response {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
