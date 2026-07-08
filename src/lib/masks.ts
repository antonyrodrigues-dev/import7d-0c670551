/**
 * 7D IMPORTS — Máscaras e validadores canônicos.
 *
 * Cada helper tem duas variantes:
 *   - `format*`  aplica a máscara para exibição no input.
 *   - `sanitize*` normaliza para o formato de persistência (apenas dígitos,
 *     handle sem @, etc.). O que vai para o banco/localStorage é sempre a
 *     forma sanitizada — máscara é responsabilidade da camada de UI.
 */

/** Mantém apenas dígitos. */
export function digitsOnly(v: string): string {
  return (v ?? "").replace(/\D+/g, "");
}

/** Aplica máscara brasileira +55 (DD) 9NNNN-NNNN sobre dígitos. */
export function formatPhoneBR(raw: string): string {
  const d = digitsOnly(raw).slice(0, 13); // 55 + DDD(2) + 9 dígitos
  if (d.length === 0) return "";
  // Se não começar com 55, assumir número brasileiro sem DDI.
  const withCountry = d.startsWith("55") ? d : `55${d}`.slice(0, 13);
  const cc = withCountry.slice(0, 2);
  const ddd = withCountry.slice(2, 4);
  const rest = withCountry.slice(4);
  if (rest.length === 0) return `+${cc}${ddd ? ` (${ddd}` : ""}`;
  if (rest.length <= 4) return `+${cc} (${ddd}) ${rest}`;
  if (rest.length <= 8) return `+${cc} (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `+${cc} (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
}

/** Retorna apenas os dígitos, com DDI 55 garantido (formato E.164 sem +). */
export function sanitizePhoneBR(raw: string): string {
  const d = digitsOnly(raw);
  if (d.length === 0) return "";
  const withCountry = d.startsWith("55") ? d : `55${d}`;
  return withCountry.slice(0, 13);
}

/** Válido quando tem 55 + DDD (2) + 8 ou 9 dígitos. */
export function isValidPhoneBR(raw: string): boolean {
  const d = sanitizePhoneBR(raw);
  return d.length === 12 || d.length === 13;
}

/** Aplica máscara 99999-999 sobre dígitos. */
export function formatCEP(raw: string): string {
  const d = digitsOnly(raw).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function sanitizeCEP(raw: string): string {
  return digitsOnly(raw).slice(0, 8);
}

export function isValidCEP(raw: string): boolean {
  return sanitizeCEP(raw).length === 8;
}

/** RFC 5322 simplificado — suficiente para o front. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(raw: string): boolean {
  const v = (raw ?? "").trim();
  return v.length > 0 && v.length <= 254 && EMAIL_RE.test(v);
}

/**
 * Normaliza um handle/URL de Instagram para `@usuario`. Aceita:
 *   `@usuario`, `usuario`, `instagram.com/usuario`,
 *   `https://instagram.com/usuario/?igshid=...`
 */
export function sanitizeInstagram(raw: string): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  try {
    const maybeUrl = v.startsWith("http") ? new URL(v) : new URL(`https://${v}`);
    if (/(^|\.)instagram\.com$/i.test(maybeUrl.hostname)) {
      const handle = maybeUrl.pathname.split("/").filter(Boolean)[0];
      if (handle) return `@${handle.toLowerCase()}`;
    }
  } catch {
    /* not a URL — fall through */
  }
  return `@${v.replace(/^@/, "").split(/[\/\s?]/)[0].toLowerCase()}`;
}

export function isValidInstagram(raw: string): boolean {
  const v = sanitizeInstagram(raw);
  return v === "" || /^@[a-z0-9._]{1,30}$/i.test(v);
}

/** Normaliza handle/URL de Facebook para `@pagina`. */
export function sanitizeFacebook(raw: string): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  try {
    const maybeUrl = v.startsWith("http") ? new URL(v) : new URL(`https://${v}`);
    if (/(^|\.)facebook\.com$/i.test(maybeUrl.hostname)) {
      const handle = maybeUrl.pathname.split("/").filter(Boolean)[0];
      if (handle) return `@${handle}`;
    }
  } catch {
    /* not a URL */
  }
  return `@${v.replace(/^@/, "").split(/[\/\s?]/)[0]}`;
}

/** Capitaliza cada palavra (respeitando conectivos comuns em PT-BR). */
export function capitalizeName(raw: string): string {
  const lower = new Set(["da", "de", "do", "das", "dos", "e"]);
  return (raw ?? "")
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((w, i) =>
      w.length === 0
        ? w
        : i > 0 && lower.has(w)
          ? w
          : w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1),
    )
    .join(" ");
}