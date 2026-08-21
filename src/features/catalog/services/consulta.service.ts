/**
 * Estado público da peça — FUNIL ÚNICO.
 *
 * Regra de negócio: toda peça ativa do acervo entra no MESMO funil
 * (Reserva → Dados → WhatsApp). Peças sem preço ou sem tamanho confirmados
 * não somem da vitrine nem viram um caminho paralelo: elas entram na reserva
 * marcadas como "Sob consulta" e a equipe confirma os dados no atendimento.
 *
 * Só ficam fora do funil as peças esgotadas ou inativas — nessas, resta a
 * consulta simples pelo WhatsApp oficial (sem pedido, sem reserva de estoque).
 */
import { formatBRL, SOB_CONSULTA, type PublicProduct } from "../types";

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
  /** `true` quando preço, tamanho e saldo estão todos confirmados. */
  comprable: boolean;
  /** `true` quando a peça pode entrar na reserva (mesmo com pendências). */
  reservavel: boolean;
  /** Explicação curta do que será confirmado no atendimento. */
  nota: string | null;
}

/** Deriva o estado público a partir dos dados oficiais do catálogo. */
export function productPublicState(p: PublicProduct): PublicStatus {
  const temPreco = p.precoConfirmado;
  const temTamanho = p.tamanhoConfirmado && p.sizes.length > 0;
  const temSaldo = p.stock > 0;

  if (p.compravel && temSaldo) {
    return {
      state: "disponivel",
      label: "Disponível",
      cta: "Adicionar à reserva",
      comprable: true,
      reservavel: true,
      nota: null,
    };
  }

  // Peça inativa/arquivada ou com tamanho confirmado porém sem saldo: esgotada.
  if (!p.reservavel || (temTamanho && !temSaldo)) {
    return {
      state: "esgotado",
      label: "Indisponível",
      cta: "Consultar peça",
      comprable: false,
      reservavel: false,
      nota: "Esta peça não está disponível para reserva no momento.",
    };
  }

  if (!temPreco && !temTamanho) {
    return {
      state: "consultar_disponibilidade",
      label: "Sob consulta",
      cta: "Reservar sob consulta",
      comprable: false,
      reservavel: true,
      nota: "Tamanho e valor são confirmados pela equipe no atendimento.",
    };
  }
  if (!temTamanho) {
    return {
      state: "consultar_tamanho",
      label: "Tamanho a confirmar",
      cta: "Reservar sob consulta",
      comprable: false,
      reservavel: true,
      nota: "O tamanho desta peça é confirmado pela equipe no atendimento.",
    };
  }
  if (!temPreco) {
    return {
      state: "consultar_preco",
      label: "Preço sob consulta",
      cta: "Reservar sob consulta",
      comprable: false,
      reservavel: true,
      nota: "O valor final desta peça é confirmado pela equipe no atendimento.",
    };
  }
  return {
    state: "em_conferencia",
    label: "Em conferência",
    cta: "Reservar sob consulta",
    comprable: false,
    reservavel: true,
    nota: "Peça em conferência final — a equipe confirma os detalhes no atendimento.",
  };
}

/**
 * Mensagem de CONSULTA simples (peça fora do funil de reserva). Nunca imprime
 * `R$ 0,00`, `NaN`, `undefined` nem tamanho vazio.
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
