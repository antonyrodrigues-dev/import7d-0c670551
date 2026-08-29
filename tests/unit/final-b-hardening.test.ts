import { describe, expect, it } from "vitest";

import { isClientAbort } from "../../src/lib/client-abort";
import { assertBrowserKeyIsPublic } from "../../src/lib/env-guard";
import { withSecurityHeaders } from "../../src/lib/security-headers";

describe("FINAL-B — abortos reais vs erros reais", () => {
  it("silencia apenas aborto real do navegador", () => {
    expect(isClientAbort(Object.assign(new Error("x"), { name: "AbortError" }))).toBe(true);
    expect(isClientAbort(Object.assign(new Error("aborted"), { code: "ECONNRESET" }))).toBe(true);
    expect(isClientAbort(new Error("aborted"))).toBe(true);
  });

  it("nunca esconde falha real de servidor/banco", () => {
    expect(isClientAbort(new Error("permission denied for table pedidos"))).toBe(false);
    expect(isClientAbort(new Error("Internal Server Error"))).toBe(false);
    expect(isClientAbort({ cause: new Error("boom") })).toBe(false);
  });
});

describe("FINAL-B — guarda de chave do cliente", () => {
  it("rejeita chave secreta no bundle do navegador", () => {
    expect(() => assertBrowserKeyIsPublic("sb_secret_abc123")).toThrow(/chave secreta/i);
    expect(() => assertBrowserKeyIsPublic("eyJhbG.service_role.zzz")).toThrow(/chave secreta/i);
  });

  it("aceita chave publicável", () => {
    expect(() => assertBrowserKeyIsPublic("sb_publishable_abc")).not.toThrow();
    expect(() => assertBrowserKeyIsPublic("eyJhbGciOiJIUzI1NiJ9.anon.sig")).not.toThrow();
    expect(() => assertBrowserKeyIsPublic(undefined)).not.toThrow();
  });
});

describe("FINAL-B — cabeçalhos de segurança", () => {
  it("aplica CSP/HSTS em respostas HTML", () => {
    const res = withSecurityHeaders(
      new Response("<html></html>", { headers: { "content-type": "text/html; charset=utf-8" } }),
    );
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=31536000");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("não altera respostas que não são HTML", () => {
    const res = withSecurityHeaders(
      new Response("{}", { headers: { "content-type": "application/json" } }),
    );
    expect(res.headers.get("content-security-policy")).toBeNull();
  });
});
