/**
 * Estado público da peça e mensagens de CONSULTA.
 *
 * Regra de negócio (F1.2/F1.3): uma peça incompleta NÃO desaparece da vitrine
 * e NÃO pode ser reservada. Ela vira consulta — que é apenas uma conversa de
 * WhatsApp: nunca chama `criar_pedido`, nunca reserva estoque, nunca entra no
 * Financeiro e nunca gera pedido fictício.
 */
import { formatBRL, type PublicProduct } from "../types";

export type PublicState =
  | "disponivel"
  | "consultar_tamanho"
  | "consultar_preco"
  | "consultar_disponibilidade"
  | "esgotado"
  | "em_conferencia";

export interface PublicStatus {
  state: PublicState;
  /** Rótulo curto para badge da vitrine. */
  label: string;
  /** Texto do botão principal. */
  cta: string;
  /** `true` quando a peça pode entrar na reserva real. */
  comprable: boolean;
}

/** Deriva o estado público a partir dos dados oficiais do catálogo. */
export function productPublicState(p: PublicProduct): PublicStatus {
  const temPreco = p.precoConfirmado;
  const temTamanho = p.sizes.length > 0;
  const temSaldo = p.stock > 0;

  if (p.compravel && temSaldo) {
    return { state: "disponivel", label: "Disponível", cta: "Reservar", comprable: true };
  }
  if (!temPreco && !temTamanho) {
    return {
      state: "consultar_disponibilidade",
      label: "Em conferência",
      cta: "Consultar disponibilidade",
      comprable: false,
    };
  }
  if (!temTamanho) {
    return {
      state: "consultar_tamanho",
      label: "Falta tamanho",
      cta: "Consultar tamanho",
      comprable: false,
    };
  }
  if (!temPreco) {
    return {
      state: "consultar_preco",
      label: "Falta preço",
      cta: "Consultar preço",
      comprable: false,
    };
  }
  if (!temSaldo) {
    return { state: "esgotado", label: "Indisponível", cta: "Consultar peça", comprable: false };
  }
  return {
    state: "em_conferencia",
    label: "Em conferência",
    cta: "Consultar disponibilidade",
    comprable: false,
  };
}

const SOB_CONSULTA = "Sob consulta";

/**
 * Mensagem de CONSULTA. Nunca imprime `R$ 0,00`, `NaN`, `undefined`, `null`
 * nem tamanho vazio — o que não é oficialmente conhecido vira "Sob consulta".
 */
export function buildConsultaMessage(p: PublicProduct, size?: string | null): string {
  const status = productPublicState(p);
  const tamanho =
    typeof size === "string" && size.trim().length > 0
      ? size.trim()
      : p.sizes.length === 1
        ? (p.sizes[0] as string)
        : SOB_CONSULTA;
  const preco =
    p.precoConfirmado && Number.isFinite(p.price) && p.price > 0
      ? formatBRL(p.price)
      : SOB_CONSULTA;

  const pedido =
    tamanho === SOB_CONSULTA && preco === SOB_CONSULTA
      ? "Gostaria de confirmar tamanho, valor e disponibilidade."
      : tamanho === SOB_CONSULTA
        ? "Gostaria de confirmar o tamanho disponível desta peça."
        : preco === SOB_CONSULTA
          ? "Gostaria de confirmar o valor desta peça."
          : "Gostaria de confirmar a disponibilidade desta peça.";

  return [
    "*7D IMPORTS — CONSULTA*",
    "",
    `Produto: ${p.name}`,
    `Referência: ${p.slug}`,
    `Tamanho: ${tamanho}`,
    `Preço: ${preco}`,
    `Disponibilidade: ${status.label}`,
    "",
    pedido,
  ].join("\n");
}

/** Link de consulta no WhatsApp OFICIAL da loja (número vem das Configurações). */
export function buildConsultaUrl(whatsapp: string, p: PublicProduct, size?: string | null): string {
  const digits = String(whatsapp ?? "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(buildConsultaMessage(p, size))}`;
}
