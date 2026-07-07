/**
 * Implementação atual do `AdminDataSource` — usa a integração Lovable Cloud.
 *
 * É o ÚNICO arquivo do admin que conhece a biblioteca de acesso a dados
 * concreta. Substituir por outro backend é substituir este arquivo.
 */

import { supabase } from "@/integrations/supabase/client";
import type { AdminIdentity, AdminDataSource } from "./types";
import type {
  AdminOrder,
  Employee,
  EmployeeRole,
  OrderItem,
  OrderPayment,
  OrderStatus,
} from "../types";

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
  if (raw === "pendente") return "novo";
  if (raw === "confirmado") return "finalizado";
  return "novo";
}

function parseItens(raw: unknown) {
  const fallback = {
    itens: [] as OrderItem[],
    nome: "—",
    telefone: "—",
    cidade: undefined as string | undefined,
    entrega: "retirada" as "entrega" | "retirada",
    endereco: undefined as string | undefined,
    pagamento: { metodo: "—" } as OrderPayment,
    observacoes: undefined as string | undefined,
  };
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const produtos = Array.isArray(o.produtos)
    ? (o.produtos as OrderItem[])
    : Array.isArray(o)
      ? (o as OrderItem[])
      : [];
  const cliente = (o.cliente as { nome?: string; telefone?: string; cidade?: string }) ?? {};
  const entregaObj = (o.entrega as { metodo?: string; endereco?: string }) ?? {};
  const pagamentoObj =
    (o.pagamento as { metodo?: string; parcelas?: number; valorParcela?: number }) ?? {};
  return {
    itens: produtos,
    nome: cliente.nome ?? "—",
    telefone: cliente.telefone ?? "—",
    cidade: cliente.cidade,
    entrega: entregaObj.metodo === "entrega" ? ("entrega" as const) : ("retirada" as const),
    endereco: entregaObj.endereco,
    pagamento: {
      metodo: pagamentoObj.metodo ?? "—",
      parcelas: pagamentoObj.parcelas,
      valorParcela: pagamentoObj.valorParcela,
    },
    observacoes: typeof o.observacoes === "string" ? o.observacoes : undefined,
  };
}

function mapRow(row: PedidoRow): AdminOrder {
  const parsed = parseItens(row.itens);
  const quantidadeTotal = parsed.itens.reduce((a, it) => a + (it.quantity ?? 0), 0);
  const status = mapStatus(row.status);
  return {
    id: row.id,
    numero: row.numero_pedido,
    cliente: { nome: parsed.nome, telefone: parsed.telefone, cidade: parsed.cidade },
    itens: parsed.itens,
    quantidadeTotal,
    valorTotal: Number(row.valor_total) || 0,
    entrega: parsed.entrega,
    endereco: parsed.endereco,
    pagamento: parsed.pagamento,
    status,
    observacoes: parsed.observacoes,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    historico: [
      { status: "novo", at: row.criado_em, note: "Pedido criado" },
      ...(status !== "novo"
        ? [{ status, at: row.atualizado_em, note: "Status atual" } as const]
        : []),
    ],
  };
}

function mapDbRole(dbRole: string): EmployeeRole | null {
  if (dbRole === "admin") return "admin";
  if (dbRole === "atendente" || dbRole === "vendedor") return "vendedor";
  return null;
}

export const lovableCloudDataSource: AdminDataSource = {
  async currentIdentity(): Promise<AdminIdentity> {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return { userId: null, roles: [] };
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (data ?? [])
      .map((r) => mapDbRole(String(r.role)))
      .filter((r): r is EmployeeRole => Boolean(r));
    return { userId: user.id, roles };
  },

  async listOrders(): Promise<AdminOrder[]> {
    const { data, error } = await supabase
      .from("pedidos")
      .select("id, numero_pedido, itens, valor_total, status, canal, criado_em, atualizado_em")
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => mapRow(r as PedidoRow));
  },

  async updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
    const { error } = await supabase.from("pedidos").update({ status }).eq("id", id);
    if (error) throw error;
  },

  async listEmployees(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from("user_roles")
      .select("id, user_id, role, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const seen = new Map<string, Employee>();
    for (const row of data ?? []) {
      const role: EmployeeRole = row.role === "admin" ? "admin" : "vendedor";
      const id = String(row.user_id);
      const criadoEm = String(row.created_at ?? new Date().toISOString());
      if (!seen.has(id)) {
        seen.set(id, {
          id,
          nome: id.slice(0, 8),
          login: id.slice(0, 8),
          email: undefined,
          role,
          status: "ativo",
          ultimoAcesso: null,
          criadoEm,
          ativo: true,
        });
      } else if (role === "admin") {
        seen.get(id)!.role = "admin";
      }
    }
    return Array.from(seen.values());
  },
};