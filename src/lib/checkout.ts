import { z } from "zod";

/**
 * 7D IMPORTS — Checkout
 * Regras, validações e utilitários do fluxo de compra.
 * Enquanto não há backend definitivo, o número de pedido é gerado localmente.
 */

export const STORE_ORIGIN = {
  address: "Rua Luiz Veronesi, 464 — Cinquentenário, Caxias do Sul · RS",
  cep: "95012-500",
  city: "Caxias do Sul",
  uf: "RS",
} as const;

export type DeliveryMethod = "entrega" | "retirada";
export type PaymentMethod = "pix" | "debito" | "credito" | "dinheiro";

export const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  entrega: "Entrega",
  retirada: "Retirada na loja",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pix: "PIX",
  debito: "Cartão de Débito",
  credito: "Cartão de Crédito",
  dinheiro: "Dinheiro",
};

const digits = (s: string) => s.replace(/\D+/g, "");

export const isValidCEP = (s: string) => digits(s).length === 8;
export const isValidPhone = (s: string) => {
  const d = digits(s);
  return d.length >= 10 && d.length <= 11;
};
export const isValidCPF = (s: string) => digits(s).length === 11;

export const addressSchema = z.object({
  cep: z.string().refine(isValidCEP, "CEP inválido"),
  rua: z.string().trim().min(2, "Informe a rua").max(120),
  numero: z.string().trim().min(1, "Informe o número").max(10),
  complemento: z.string().trim().max(60).optional().default(""),
  bairro: z.string().trim().min(2, "Informe o bairro").max(80),
  cidade: z.string().trim().min(2, "Informe a cidade").max(80),
});
export type Address = z.infer<typeof addressSchema>;

export const customerSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(120),
  telefone: z.string().refine(isValidPhone, "Telefone inválido"),
  cpf: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || isValidCPF(v), "CPF inválido"),
  observacoes: z.string().trim().max(500).optional().default(""),
});
export type Customer = z.infer<typeof customerSchema>;

export function generateOrderNumber(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `7D-${yyyy}${mm}${dd}-${rand}`;
}

export interface Freight {
  cost: number | null;
  label: string;
}

/**
 * Arquitetura preparada para cálculo automático a partir do CEP de origem
 * (loja em Caxias do Sul) até o CEP do cliente. Integração real (Correios /
 * Melhor Envio / transportadora própria) entra aqui sem alterar o restante
 * do fluxo. Enquanto isso, retorna "A combinar".
 */
export async function calculateFreight(_address: Address): Promise<Freight> {
  return { cost: null, label: "A combinar" };
}

// ---------- máscaras ----------
export function formatCEP(v: string) {
  const d = digits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function formatPhone(v: string) {
  const d = digits(v).slice(0, 11);
  if (!d) return "";
  if (d.length < 3) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length === 0) return `(${ddd})`;
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

export function formatCPF(v: string) {
  const d = digits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ---------- ViaCEP (best-effort) ----------
export async function lookupCEP(
  cep: string,
  signal?: AbortSignal,
): Promise<Partial<Address> | null> {
  const d = digits(cep);
  if (d.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
    };
    if (j.erro) return null;
    return {
      rua: j.logradouro || "",
      bairro: j.bairro || "",
      cidade: j.localidade || "",
    };
  } catch {
    return null;
  }
}
