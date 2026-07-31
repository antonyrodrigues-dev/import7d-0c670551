/**
 * 7D IMPORTS — Adapter operacional da Onda 0.
 *
 * ÚNICO ponto do painel que conhece as RPCs protegidas de reservas, fila de
 * atendimento, pagamentos, devoluções, equipe, parâmetros, métricas
 * financeiras e notificações persistentes. Services falam só com esta
 * interface; nenhum componente React chama `supabase.rpc` diretamente.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  FinancePeriod,
  OperationalParams,
  PaymentEntry,
  PaymentInput,
  QueueOrder,
  RemoteNotification,
  ReturnInput,
  ReturnRecord,
  TeamMember,
  TeamSituation,
} from "../types";
import { DEFAULT_PARAMS, PARAM_LIMITS } from "../types";

type Json = Record<string, unknown>;

function asRecord(v: unknown): Json {
  return v && typeof v === "object" ? (v as Json) : {};
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function minutesBetween(fromIso: string, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - new Date(fromIso).getTime()) / 60000));
}

interface QueueRawItem {
  slug?: string;
  name?: string;
  size?: string;
  quantity?: number;
}

/** Contrato do backend operacional. */
export interface AdminOpsDataSource {
  // Reservas
  reconcileReservations(): Promise<number>;

  // Fila de atendimento
  listQueue(params: OperationalParams): Promise<{ fila: QueueOrder[]; emAtendimento: QueueOrder[] }>;
  claimOrder(pedidoId: string): Promise<void>;
  transferOrder(pedidoId: string, novoResponsavel: string, observacao?: string): Promise<void>;
  releaseOrder(pedidoId: string, observacao?: string): Promise<void>;

  // Pagamentos
  listPayments(pedidoId: string): Promise<PaymentEntry[]>;
  registerPayment(input: PaymentInput): Promise<void>;

  // Devoluções
  listReturns(pedidoId: string): Promise<ReturnRecord[]>;
  registerReturn(input: ReturnInput): Promise<string>;

  // Equipe
  listTeam(): Promise<TeamMember[]>;
  setMemberStatus(userId: string, status: Exclude<TeamSituation, "aguardando_liberacao">): Promise<void>;

  // Parâmetros
  getParams(): Promise<OperationalParams>;
  setParam(chave: string, valor: number): Promise<void>;

  // Financeiro (RPC restrita ao Admin Master)
  financeMetrics(periodo: FinancePeriod): Promise<Json>;

  // Notificações persistentes
  listNotifications(userId: string | null, limit?: number): Promise<RemoteNotification[]>;
  markNotificationRead(id: string, userId: string): Promise<void>;
  markAllNotificationsRead(ids: string[], userId: string): Promise<void>;

  /** Realtime: assina mudanças operacionais e devolve o unsubscribe. */
  subscribeOps(onChange: () => void): () => void;
}

function priorityOf(minutos: number, params: OperationalParams): QueueOrder["prioridade"] {
  if (minutos >= params.atendimentoAtrasadoMinutos) return "atrasado";
  if (minutos >= params.alertaAtendimentoMinutos) return "alerta";
  return "normal";
}

interface PedidoQueueRow {
  id: string;
  numero_pedido: string;
  itens: unknown;
  valor_total: number | string;
  status: string;
  criado_em: string;
  atribuido_em: string | null;
  responsavel_id: string | null;
  atendente_nome: string | null;
  whatsapp_declarado_enviado_em: string | null;
}

function mapQueueOrder(
  row: PedidoQueueRow,
  reserva: string | null,
  params: OperationalParams,
  now: Date,
): QueueOrder {
  const payload = asRecord(row.itens);
  const cliente = asRecord(payload.cliente);
  const entrega = asRecord(payload.entrega);
  const produtos = Array.isArray(payload.produtos) ? (payload.produtos as QueueRawItem[]) : [];
  const itens = produtos.map((p) => ({
    slug: String(p.slug ?? ""),
    name: String(p.name ?? ""),
    size: String(p.size ?? ""),
    quantity: num(p.quantity, 1),
  }));
  const aguardando = minutesBetween(row.criado_em, now);
  const restantes = reserva
    ? Math.round((new Date(reserva).getTime() - now.getTime()) / 60000)
    : null;

  return {
    id: row.id,
    numero: row.numero_pedido,
    cliente: String(cliente.nome ?? "—"),
    telefone: String(cliente.telefone ?? "—"),
    modalidade: entrega.metodo === "entrega" ? "entrega" : "retirada",
    itens,
    quantidadeItens: itens.reduce((acc, i) => acc + i.quantity, 0),
    valorTotal: num(row.valor_total),
    status: row.status,
    whatsappDeclarado: Boolean(row.whatsapp_declarado_enviado_em),
    criadoEm: row.criado_em,
    aguardandoMinutos: aguardando,
    reservaExpiraEm: reserva,
    reservaMinutosRestantes: restantes,
    prioridade: priorityOf(aguardando, params),
    responsavelId: row.responsavel_id,
    responsavelNome: row.atendente_nome,
    atribuidoEm: row.atribuido_em,
  };
}

const FILA_STATUS = ["novo", "whatsapp_declarado", "aguardando_atendimento"];

export const opsDataSource: AdminOpsDataSource = {
  async reconcileReservations() {
    const { data, error } = await supabase.rpc("expirar_reservas");
    if (error) throw error;
    return num(data);
  },

  async listQueue(params) {
    const { data, error } = await supabase
      .from("pedidos")
      .select(
        "id,numero_pedido,itens,valor_total,status,criado_em,atribuido_em,responsavel_id,atendente_nome,whatsapp_declarado_enviado_em",
      )
      .in("status", [...FILA_STATUS, "em_atendimento"])
      .order("criado_em", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as PedidoQueueRow[];
    if (rows.length === 0) return { fila: [], emAtendimento: [] };

    const { data: reservas, error: rErr } = await supabase
      .from("reservas_estoque")
      .select("pedido_id,expira_em,estado")
      .in(
        "pedido_id",
        rows.map((r) => r.id),
      )
      .in("estado", ["reservada_temporariamente", "em_atendimento"]);
    if (rErr) throw rErr;

    const expiry = new Map<string, string>();
    for (const r of reservas ?? []) {
      if (!r.expira_em) continue;
      const cur = expiry.get(r.pedido_id);
      if (!cur || new Date(r.expira_em) < new Date(cur)) expiry.set(r.pedido_id, r.expira_em);
    }

    const now = new Date();
    const mapped = rows.map((r) => mapQueueOrder(r, expiry.get(r.id) ?? null, params, now));
    return {
      fila: mapped.filter((o) => FILA_STATUS.includes(o.status)),
      emAtendimento: mapped.filter((o) => o.status === "em_atendimento"),
    };
  },

  async claimOrder(pedidoId) {
    const { error } = await supabase.rpc("assumir_atendimento", { p_pedido_id: pedidoId });
    if (error) throw error;
  },

  async transferOrder(pedidoId, novoResponsavel, observacao) {
    const { error } = await supabase.rpc("transferir_atendimento", {
      p_pedido_id: pedidoId,
      p_novo_responsavel: novoResponsavel,
      p_observacao: observacao ?? null,
    });
    if (error) throw error;
  },

  async releaseOrder(pedidoId, observacao) {
    const { error } = await supabase.rpc("devolver_para_fila", {
      p_pedido_id: pedidoId,
      p_observacao: observacao ?? null,
    });
    if (error) throw error;
  },

  async listPayments(pedidoId) {
    const { data, error } = await supabase
      .from("pedido_pagamentos")
      .select("id,pedido_id,estado,valor,metodo,comprovante_url,observacao,criado_em,por_usuario")
      .eq("pedido_id", pedidoId)
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      pedidoId: r.pedido_id,
      estado: r.estado as PaymentEntry["estado"],
      valor: num(r.valor),
      metodo: r.metodo,
      comprovanteUrl: r.comprovante_url,
      observacao: r.observacao,
      criadoEm: r.criado_em,
      porUsuario: r.por_usuario,
    }));
  },

  async registerPayment(input) {
    const { error } = await supabase.rpc("registrar_pagamento", {
      p_pedido_id: input.pedidoId,
      p_estado: input.estado,
      p_comprovante_url: input.comprovanteUrl ?? null,
      p_observacao: input.observacao ?? null,
    });
    if (error) throw error;
  },

  async listReturns(pedidoId) {
    const { data, error } = await supabase
      .from("pedido_devolucoes")
      .select(
        "id,pedido_id,motivo,valor_estornado,observacoes,criado_em,pedido_devolucao_itens(slug,tamanho,quantidade,condicao)",
      )
      .eq("pedido_id", pedidoId)
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      pedidoId: r.pedido_id,
      motivo: r.motivo,
      valorEstornado: num(r.valor_estornado),
      observacoes: r.observacoes,
      criadoEm: r.criado_em,
      itens: (r.pedido_devolucao_itens ?? []).map((i) => ({
        slug: i.slug,
        tamanho: i.tamanho,
        quantidade: i.quantidade,
        condicao: i.condicao as ReturnRecord["itens"][number]["condicao"],
      })),
    }));
  },

  async registerReturn(input) {
    const { data, error } = await supabase.rpc("registrar_devolucao", {
      p_pedido_id: input.pedidoId,
      p_itens: input.itens as unknown as Json[],
      p_motivo: input.motivo,
      p_valor_estornado: input.valorEstornado,
      p_observacoes: input.observacoes ?? null,
      p_evidencias: (input.evidencias ?? []) as unknown as Json[],
    });
    if (error) throw error;
    return String(data);
  },

  async listTeam() {
    const { data, error } = await supabase.rpc("listar_equipe");
    if (error) throw error;
    return (data ?? []).map((r) => ({
      userId: r.user_id,
      email: r.email ?? "",
      nome: r.nome ?? "",
      telefone: r.telefone,
      situacao: (r.situacao ?? "ativo") as TeamMember["situacao"],
      roles: r.roles ?? [],
      ultimoAcesso: r.ultimo_acesso,
      criadoEm: r.criado_em,
    }));
  },

  async setMemberStatus(userId, status) {
    const { error } = await supabase
      .from("profiles")
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw error;
  },

  async getParams() {
    const { data, error } = await supabase.from("parametros_operacionais").select("chave,valor");
    if (error) throw error;
    const byKey = new Map((data ?? []).map((r) => [r.chave, num(r.valor)]));
    const out = { ...DEFAULT_PARAMS };
    (Object.keys(PARAM_LIMITS) as (keyof OperationalParams)[]).forEach((k) => {
      const v = byKey.get(PARAM_LIMITS[k].chave);
      if (typeof v === "number" && v > 0) out[k] = v;
    });
    return out;
  },

  async setParam(chave, valor) {
    const { error } = await supabase.rpc("definir_parametro", {
      p_chave: chave,
      p_valor: valor as unknown as Json,
    });
    if (error) throw error;
  },

  async financeMetrics(periodo) {
    const { data, error } = await supabase.rpc("metricas_financeiras", { p_periodo: periodo });
    if (error) throw error;
    return asRecord(data);
  },

  async listNotifications(userId, limit = 100) {
    const { data, error } = await supabase
      .from("notificacoes")
      .select("id,tipo,titulo,mensagem,severidade,entidade,entidade_id,criado_em")
      .order("criado_em", { ascending: false })
      .limit(limit);
    if (error) throw error;

    let lidos = new Set<string>();
    if (userId) {
      const { data: reads, error: rErr } = await supabase
        .from("notificacao_leituras")
        .select("notificacao_id")
        .eq("user_id", userId);
      if (rErr) throw rErr;
      lidos = new Set((reads ?? []).map((r) => r.notificacao_id));
    }

    return (data ?? []).map((n) => ({
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      mensagem: n.mensagem,
      severidade: n.severidade as RemoteNotification["severidade"],
      entidade: n.entidade,
      entidadeId: n.entidade_id,
      criadoEm: n.criado_em,
      lido: lidos.has(n.id),
    }));
  },

  async markNotificationRead(id, userId) {
    const { error } = await supabase
      .from("notificacao_leituras")
      .upsert({ notificacao_id: id, user_id: userId }, { onConflict: "notificacao_id,user_id" });
    if (error) throw error;
  },

  async markAllNotificationsRead(ids, userId) {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("notificacao_leituras")
      .upsert(
        ids.map((notificacao_id) => ({ notificacao_id, user_id: userId })),
        { onConflict: "notificacao_id,user_id" },
      );
    if (error) throw error;
  },

  subscribeOps(onChange) {
    const channel = supabase
      .channel("7d-admin-ops")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservas_estoque" }, onChange)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  },
};