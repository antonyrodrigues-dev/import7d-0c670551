/**
 * Serviço de pedidos administrativos.
 *
 * Camada única entre stores/UI e o backend. Alterar a origem (Supabase,
 * REST, cache local) só afeta este arquivo.
 */

import { supabase } from "@/integrations/supabase/client";
import type { AdminOrder, AdminOrderItem, OrderStatus } from "../types";

interface PedidoRow {
  id: string;
  numero_pedido: string;
  itens: unknown;
  valor_total: number | string;
  status: string;
  canal: string | null;
  criado_em: string;
  atualizado_em: string;
}

function mapStatus(raw: string): OrderStatus {
  const known: OrderStatus[] = [
    "novo",
    "separado",
    "reservado",
    "aguardando_retirada",
    "enviado",
    "finalizado",
    "cancelado",
  ];
  if ((known as string[]).includes(raw)) return raw as OrderStatus;
  // Compatibilidade com registros antigos:
  if (raw === "pendente") return "novo";
  if (raw === "confirmado") return "finalizado";
  return "novo";
}

function parseItens(raw: unknown): { itens: AdminOrderItem[]; nome: string; telefone: string; entrega: "entrega" | "retirada"; pagamento: string } {
  const fallback = { itens: [] as AdminOrderItem[], nome: "—", telefone: "—", entrega: "retirada" as const, pagamento: "—" };
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const produtos = Array.isArray(o.produtos)
    ? (o.produtos as AdminOrderItem[])
    : Array.isArray(o)
      ? (o as AdminOrderItem[])
      : [];
  const cliente = (o.cliente as { nome?: string; telefone?: string }) ?? {};
  const entregaObj = (o.entrega as { metodo?: string }) ?? {};
  const pagamentoObj = (o.pagamento as { metodo?: string }) ?? {};
  return {
    itens: produtos,
    nome: cliente.nome ?? "—",
    telefone: cliente.telefone ?? "—",
    entrega: entregaObj.metodo === "entrega" ? "entrega" : "retirada",
    pagamento: pagamentoObj.metodo ?? "—",
  };
}

function mapRow(row: PedidoRow): AdminOrder {
  const parsed = parseItens(row.itens);
  return {
    id: row.id,
    numero: row.numero_pedido,
    cliente: { nome: parsed.nome, telefone: parsed.telefone },
    itens: parsed.itens,
    valorTotal: Number(row.valor_total) || 0,
    entrega: parsed.entrega,
    pagamento: parsed.pagamento,
    status: mapStatus(row.status),
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

export async function listOrders(): Promise<AdminOrder[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, numero_pedido, itens, valor_total, status, canal, criado_em, atualizado_em")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapRow(r as PedidoRow));
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase.from("pedidos").update({ status }).eq("id", id);
  if (error) throw error;
}