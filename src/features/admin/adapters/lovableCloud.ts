/**
 * Implementação atual do `AdminDataSource` — usa a integração Lovable Cloud.
 *
 * É o ÚNICO arquivo do admin que conhece a biblioteca de acesso a dados
 * concreta. Substituir por outro backend é substituir este arquivo.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  AdminIdentity,
  AdminDataSource,
  ProductWritePayload,
  MovementKindDB,
} from "./types";
import type {
  AdminOrder,
  Employee,
  EmployeeRole,
  InventoryItem,
  OrderItem,
  OrderPayment,
  OrderStatus,
  StockEntry,
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
    "pagamento_confirmado",
    "separado",
    "reservado",
    "aguardando_retirada",
    "enviado",
    "finalizado",
    "cancelado",
  ];
  if ((known as string[]).includes(raw)) return raw as OrderStatus;
  if (raw === "pendente") return "novo";
  if (raw === "pago") return "pagamento_confirmado";
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

  // ─────────────────────────────────────────────────────────────────────────
  // Produtos / Estoque
  // ─────────────────────────────────────────────────────────────────────────
  async listInventory(): Promise<InventoryItem[]> {
    // Uma consulta com relacionamento — evita N+1.
    const { data, error } = await supabase
      .from("produtos")
      .select(
        "id, sku, slug, nome, marca, categoria, colecao, cor, descricao, imagens, preco, ativo, destaque, arquivado_em, criado_em, atualizado_em, produto_variacoes ( tamanho, quantidade )",
      )
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapProductRow);
  },

  async createProduct(p: ProductWritePayload): Promise<string> {
    const { data, error } = await supabase
      .from("produtos")
      .insert(toProductInsert(p))
      .select("id")
      .single();
    if (error) throw error;
    await syncVariations(data.id, p.variacoes);
    return data.id;
  },

  async updateProduct(id: string, p: ProductWritePayload): Promise<void> {
    const { error } = await supabase
      .from("produtos")
      .update(toProductInsert(p))
      .eq("id", id);
    if (error) throw error;
    await syncVariations(id, p.variacoes);
  },

  async archiveProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from("produtos")
      .update({ arquivado_em: new Date().toISOString(), ativo: false })
      .eq("id", id);
    if (error) throw error;
  },

  async restoreProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from("produtos")
      .update({ arquivado_em: null, ativo: true })
      .eq("id", id);
    if (error) throw error;
  },

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) throw error;
  },

  async setVariationStock(
    productId: string,
    tamanho: string,
    quantidade: number,
    kind: MovementKindDB,
    observacao?: string,
  ): Promise<void> {
    // Lê valor atual para calcular o delta e registrar a movimentação.
    const { data: existing, error: readErr } = await supabase
      .from("produto_variacoes")
      .select("id, quantidade")
      .eq("produto_id", productId)
      .eq("tamanho", tamanho)
      .maybeSingle();
    if (readErr) throw readErr;

    const nextQty = Math.max(0, Math.floor(quantidade));
    const currentQty = existing?.quantidade ?? 0;
    const delta = nextQty - currentQty;

    if (existing) {
      const { error } = await supabase
        .from("produto_variacoes")
        .update({ quantidade: nextQty })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("produto_variacoes")
        .insert({ produto_id: productId, tamanho, quantidade: nextQty });
      if (error) throw error;
    }

    if (delta !== 0) {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("produto_movimentacoes").insert({
        produto_id: productId,
        tamanho,
        tipo: kind,
        quantidade: delta,
        por_usuario: userData.user?.id ?? null,
        observacao: observacao ?? null,
      });
      if (error) throw error;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de mapeamento produto DB ⇄ domínio.
// ─────────────────────────────────────────────────────────────────────────────

interface ProductRow {
  id: string;
  sku: string;
  slug: string;
  nome: string;
  marca: string;
  categoria: string;
  colecao: string | null;
  cor: string | null;
  descricao: string | null;
  imagens: unknown;
  preco: number | string;
  ativo: boolean;
  destaque: boolean;
  arquivado_em: string | null;
  criado_em: string;
  atualizado_em: string;
  produto_variacoes: { tamanho: string; quantidade: number }[] | null;
}

function parseImages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === "string");
  return [];
}

function mapProductRow(row: ProductRow): InventoryItem {
  const variacoes = row.produto_variacoes ?? [];
  const stockBySize: StockEntry[] = variacoes.map((v) => ({
    size: v.tamanho,
    quantity: v.quantidade,
  }));
  const images = parseImages(row.imagens);
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.nome,
    brand: row.marca,
    category: row.categoria,
    collection: row.colecao ?? undefined,
    color: row.cor ?? "—",
    description: row.descricao ?? undefined,
    images,
    image: images[0] ?? "",
    sizes: stockBySize.map((s) => s.size),
    stockBySize,
    quantity: stockBySize.reduce((a, s) => a + s.quantity, 0),
    price: Number(row.preco) || 0,
    active: row.ativo && !row.arquivado_em,
    featured: row.destaque,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function toProductInsert(p: ProductWritePayload) {
  return {
    sku: p.sku,
    slug: p.slug,
    nome: p.nome,
    marca: p.marca,
    categoria: p.categoria,
    cor: p.cor ?? null,
    colecao: p.colecao ?? null,
    descricao: p.descricao ?? null,
    imagens: p.imagens as unknown as never, // Json
    preco: p.preco,
    ativo: p.ativo,
    destaque: p.destaque,
  };
}

/**
 * Sincroniza a lista de variações desejada com o estado atual do banco:
 * upsert nas presentes, delete nas ausentes.
 */
async function syncVariations(
  productId: string,
  desired: { tamanho: string; quantidade: number }[],
): Promise<void> {
  const { data: existing, error: readErr } = await supabase
    .from("produto_variacoes")
    .select("id, tamanho, quantidade")
    .eq("produto_id", productId);
  if (readErr) throw readErr;

  const existingBySize = new Map(existing?.map((e) => [e.tamanho, e]) ?? []);
  const desiredSizes = new Set(desired.map((d) => d.tamanho));

  // Deletar tamanhos removidos.
  const toDelete = (existing ?? []).filter((e) => !desiredSizes.has(e.tamanho)).map((e) => e.id);
  if (toDelete.length > 0) {
    const { error } = await supabase.from("produto_variacoes").delete().in("id", toDelete);
    if (error) throw error;
  }

  // Upsert tamanhos desejados.
  for (const d of desired) {
    const current = existingBySize.get(d.tamanho);
    const qty = Math.max(0, Math.floor(d.quantidade));
    if (current) {
      if (current.quantidade !== qty) {
        const { error } = await supabase
          .from("produto_variacoes")
          .update({ quantidade: qty })
          .eq("id", current.id);
        if (error) throw error;
      }
    } else {
      const { error } = await supabase
        .from("produto_variacoes")
        .insert({ produto_id: productId, tamanho: d.tamanho, quantidade: qty });
      if (error) throw error;
    }
  }
}