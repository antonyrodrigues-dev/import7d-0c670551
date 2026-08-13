/**
 * 7D IMPORTS — Tipos da camada operacional da Onda 0.
 *
 * Fonte única de tipos para: reservas, fila de atendimento, pagamentos,
 * devoluções/quarentena, equipe, parâmetros operacionais e notificações
 * persistentes. Nenhum módulo pode redeclarar estes contratos.
 */

import type { IsoDateTime } from "./common";

// ───────────────────────────── Fila de atendimento ─────────────────────────

/** Prioridade derivada do tempo de espera (parâmetros operacionais). */
export type QueuePriority = "normal" | "alerta" | "atrasado";

export interface QueueOrder {
  id: string;
  numero: string;
  cliente: string;
  telefone: string;
  modalidade: "entrega" | "retirada";
  itens: { slug: string; name: string; size: string; quantity: number }[];
  quantidadeItens: number;
  valorTotal: number;
  status: string;
  whatsappDeclarado: boolean;
  criadoEm: IsoDateTime;
  /** Minutos aguardando desde a criação. */
  aguardandoMinutos: number;
  reservaExpiraEm: IsoDateTime | null;
  /** Minutos restantes de reserva; negativo = expirada. */
  reservaMinutosRestantes: number | null;
  prioridade: QueuePriority;
  responsavelId: string | null;
  responsavelNome: string | null;
  atribuidoEm: IsoDateTime | null;
}

// ───────────────────────────────── Pagamentos ──────────────────────────────

export type PaymentState =
  | "pendente"
  | "aguardando_comprovante"
  | "em_analise"
  | "confirmado"
  | "recusado"
  | "estornado";

export const PAYMENT_STATES: { key: PaymentState; label: string }[] = [
  { key: "pendente", label: "Pendente" },
  { key: "aguardando_comprovante", label: "Aguardando comprovante" },
  { key: "em_analise", label: "Em análise" },
  { key: "confirmado", label: "Confirmado" },
  { key: "recusado", label: "Recusado" },
  { key: "estornado", label: "Estornado" },
];

/** Estados que somente o Admin Master pode aplicar. */
export const PAYMENT_ADMIN_ONLY: PaymentState[] = ["confirmado", "estornado"];

export interface PaymentEntry {
  id: string;
  pedidoId: string;
  estado: PaymentState;
  valor: number;
  metodo: string | null;
  comprovanteUrl: string | null;
  observacao: string | null;
  criadoEm: IsoDateTime;
  porUsuario: string | null;
}

export interface PaymentInput {
  pedidoId: string;
  estado: PaymentState;
  comprovanteUrl?: string | null;
  observacao?: string | null;
}

// ─────────────────────────── Ledger financeiro ─────────────────────────────

/** Lançamento imutável do livro-razão (`financeiro_lancamentos`). */
export interface LedgerEntry {
  id: string;
  pedidoId: string;
  numeroPedido: string;
  tipo: "receita" | "estorno";
  origem: "pagamento" | "devolucao";
  /** Positivo em receitas, negativo em estornos. */
  valor: number;
  metodo: string | null;
  competencia: string;
  criadoEm: IsoDateTime;
}

// ───────────────────────────────── Devoluções ──────────────────────────────

export type ReturnCondition =
  | "vendavel"
  | "usada"
  | "avariada"
  | "defeituosa"
  | "divergencia"
  | "outra";

export const RETURN_CONDITIONS: { key: ReturnCondition; label: string; estoque: string }[] = [
  { key: "vendavel", label: "Vendável", estoque: "Retorna ao saldo" },
  { key: "usada", label: "Uso aparente", estoque: "Quarentena" },
  { key: "avariada", label: "Avariada", estoque: "Quarentena" },
  { key: "defeituosa", label: "Defeito", estoque: "Quarentena" },
  { key: "divergencia", label: "Divergência", estoque: "Quarentena" },
  { key: "outra", label: "Outra", estoque: "Quarentena" },
];

export interface ReturnItemInput {
  slug: string;
  size: string;
  quantity: number;
  condicao: ReturnCondition;
}

export interface ReturnInput {
  pedidoId: string;
  itens: ReturnItemInput[];
  motivo: string;
  valorEstornado: number;
  observacoes?: string | null;
  evidencias?: string[];
}

export interface ReturnRecord {
  id: string;
  pedidoId: string;
  motivo: string;
  valorEstornado: number;
  observacoes: string | null;
  criadoEm: IsoDateTime;
  itens: { slug: string; tamanho: string; quantidade: number; condicao: ReturnCondition }[];
}

// ─────────────────────────────────── Equipe ────────────────────────────────

export type TeamSituation = "ativo" | "inativo" | "aguardando_liberacao";

export interface TeamMember {
  userId: string;
  email: string;
  nome: string;
  telefone: string | null;
  situacao: TeamSituation;
  roles: string[];
  ultimoAcesso: IsoDateTime | null;
  criadoEm: IsoDateTime;
}

// ─────────────────────────── Parâmetros operacionais ───────────────────────

export interface OperationalParams {
  reservaMinutos: number;
  alertaAtendimentoMinutos: number;
  atendimentoAtrasadoMinutos: number;
  confirmacaoClienteMinutos: number;
  checkoutCooldownSegundos: number;
  checkoutMaxPedidosAbertos: number;
  checkoutMaxReservasAtivas: number;
  checkoutMaxPedidosHora: number;
}

export type OperationalParamKey = keyof OperationalParams;

/** Limites validados também no banco (`definir_parametro`). */
export const PARAM_LIMITS: Record<
  OperationalParamKey,
  { chave: string; label: string; min: number; max: number; hint: string; unidade: string }
> = {
  reservaMinutos: {
    chave: "reserva_peca_unica_minutos",
    label: "Reserva temporária (peça única)",
    min: 5,
    max: 120,
    hint: "Tempo que a peça fica reservada após o pedido.",
    unidade: "minutos",
  },
  alertaAtendimentoMinutos: {
    chave: "alerta_atendimento_minutos",
    label: "Alerta de atendimento",
    min: 1,
    max: 60,
    hint: "Minutos até destacar o pedido como prioritário na fila.",
    unidade: "minutos",
  },
  atendimentoAtrasadoMinutos: {
    chave: "atendimento_atrasado_minutos",
    label: "Atendimento atrasado",
    min: 2,
    max: 240,
    hint: "Minutos até marcar o atendimento como atrasado.",
    unidade: "minutos",
  },
  confirmacaoClienteMinutos: {
    chave: "confirmacao_cliente_minutos",
    label: "Prazo de confirmação do cliente",
    min: 5,
    max: 1440,
    hint: "Prazo para o cliente declarar o envio no WhatsApp.",
    unidade: "minutos",
  },
  checkoutCooldownSegundos: {
    chave: "checkout_cooldown_segundos",
    label: "Intervalo entre pedidos (mesmo telefone)",
    min: 10,
    max: 600,
    hint: "Tempo mínimo entre dois pedidos do mesmo telefone no checkout público.",
    unidade: "segundos",
  },
  checkoutMaxPedidosAbertos: {
    chave: "checkout_max_pedidos_abertos",
    label: "Pedidos em aberto por telefone",
    min: 1,
    max: 10,
    hint: "Máximo de pedidos não finalizados simultâneos por telefone.",
    unidade: "pedidos",
  },
  checkoutMaxReservasAtivas: {
    chave: "checkout_max_reservas_ativas",
    label: "Peças reservadas por telefone",
    min: 1,
    max: 20,
    hint: "Máximo de peças únicas reservadas ao mesmo tempo por telefone.",
    unidade: "peças",
  },
  checkoutMaxPedidosHora: {
    chave: "checkout_max_pedidos_hora",
    label: "Pedidos por hora (mesmo telefone)",
    min: 1,
    max: 30,
    hint: "Máximo de pedidos criados por telefone em 60 minutos.",
    unidade: "pedidos",
  },
};

export const DEFAULT_PARAMS: OperationalParams = {
  reservaMinutos: 20,
  alertaAtendimentoMinutos: 5,
  atendimentoAtrasadoMinutos: 10,
  confirmacaoClienteMinutos: 30,
  checkoutCooldownSegundos: 45,
  checkoutMaxPedidosAbertos: 3,
  checkoutMaxReservasAtivas: 5,
  checkoutMaxPedidosHora: 6,
};

// ─────────────────────── Notificações persistentes ─────────────────────────

export type RemoteNotificationSeverity = "info" | "sucesso" | "alerta" | "critico";

export interface RemoteNotification {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  severidade: RemoteNotificationSeverity;
  entidade: string | null;
  entidadeId: string | null;
  criadoEm: IsoDateTime;
  lido: boolean;
}

// ───────────────────────────────── Reservas ────────────────────────────────

/** Tentativa de checkout recusada pela proteção anti-abuso (append-only no banco). */
export type CheckoutBlockReason =
  | "cooldown"
  | "limite_hora"
  | "pedidos_abertos"
  | "reservas_ativas";

export interface CheckoutBlock {
  id: string;
  telefoneMascarado: string;
  motivo: CheckoutBlockReason | string;
  detalhe: Record<string, unknown>;
  criadoEm: IsoDateTime;
}

export const CHECKOUT_BLOCK_LABELS: Record<CheckoutBlockReason, string> = {
  cooldown: "Intervalo entre pedidos",
  limite_hora: "Limite de pedidos por hora",
  pedidos_abertos: "Pedidos em aberto",
  reservas_ativas: "Peças reservadas",
};

export interface ReservationRow {
  id: string;
  pedidoId: string;
  produtoId: string;
  tamanho: string;
  quantidade: number;
  estado: string;
  expiraEm: IsoDateTime | null;
}
