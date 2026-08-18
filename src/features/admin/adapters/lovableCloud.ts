/**
 * Implementação atual do `AdminDataSource` — usa a integração Lovable Cloud.
 *
 * É o ÚNICO arquivo do admin que conhece a biblioteca de acesso a dados
 * concreta. Substituir por outro backend é substituir este arquivo.
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "../lib/logger";
import type {
  AdminIdentity,
  AdminDataSource,
  KitComponentWritePayload,
  ProductWritePayload,
  MovementKindDB,
} from "./types";
import type {
  AdminOrder,
  Employee,
  EmployeeRole,
  InventoryItem,
  KitAvailability,
  KitComponent,
  OrderAddress,
  OrderItem,
  OrderPayment,
  OrderStatus,
  PaymentState,
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
  atendente_nome?: string | null;
  responsavel_id?: string | null;
  atribuido_em?: string | null;
  pagamento_estado?: string | null;
  valor_devolvido?: number | string | null;
  frete_status?: string | null;
  pedido_status_historico?:
    | {
        de: string | null;
        para: string;
        criado_em: string;
        observacao: string | null;
        por_usuario: string | null;
      }[]
    | null;
}

const KNOWN_STATUSES: OrderStatus[] = [
  "novo",
  "whatsapp_declarado",
  "aguardando_atendimento",
  "em_atendimento",
  "aguardando_pagamento",
  "pagamento_confirmado",
  "separado",
  "reservado",
  "aguardando_retirada",
  "enviado",
  "finalizado",
  "cancelado",
  "devolvido",
];

/**
 * Aliases legados que já existiram no banco antes da máquina de estados.
 * `em_atendimento` NÃO é alias — é status canônico do banco desde a Onda 0;
 * mapeá-lo para "novo" escondia pedidos já assumidos por um atendente.
 */
const LEGACY_STATUS: Record<string, OrderStatus> = {
  pendente: "novo",
  pago: "pagamento_confirmado",
  confirmado: "finalizado",
};

/**
 * Nunca inventamos "novo" para um status desconhecido: isso mascararia um
 * pedido em estágio avançado. Desconhecido é registrado como incidente e
 * preservado tal como veio, para a UI exibir o rótulo cru.
 */
function mapStatus(raw: string): OrderStatus {
  if ((KNOWN_STATUSES as string[]).includes(raw)) return raw as OrderStatus;
  const legacy = LEGACY_STATUS[raw];
  if (legacy) return legacy;
  logger.error("Status de pedido desconhecido recebido do banco.", {
    status: raw,
    origin: "lovableCloud.mapStatus",
  });
  return raw as OrderStatus;
}

const PAYMENT_STATE_KEYS: PaymentState[] = [
  "pendente",
  "aguardando_comprovante",
  "em_analise",
  "confirmado",
  "recusado",
  "estornado",
];

function mapPaymentState(raw: string | null | undefined): PaymentState {
  if (raw && (PAYMENT_STATE_KEYS as string[]).includes(raw)) return raw as PaymentState;
  return "pendente";
}

function parseAddress(raw: unknown): OrderAddress | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") return raw.trim() ? { linha: raw.trim() } : undefined;
  if (typeof raw !== "object") return undefined;
  const a = raw as Record<string, unknown>;
  const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string).trim() : "");
  const rua = str("rua");
  const numero = str("numero");
  const complemento = str("complemento");
  const bairro = str("bairro");
  const cidade = str("cidade");
  const cep = str("cep");
  const linha = [[rua, numero].filter(Boolean).join(", "), complemento, bairro, cidade, cep]
    .filter(Boolean)
    .join(" · ");
  if (!linha) return undefined;
  return { rua, numero, complemento, bairro, cidade, cep, linha };
}

function parseItens(raw: unknown) {
  const fallback = {
    itens: [] as OrderItem[],
    nome: "—",
    telefone: "—",
    cidade: undefined as string | undefined,
    entrega: "retirada" as "entrega" | "retirada",
    endereco: undefined as OrderAddress | undefined,
    frete: undefined as string | undefined,
    freteValor: null as number | null,
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
  const entregaObj =
    (o.entrega as {
      metodo?: string;
      endereco?: unknown;
      frete?: { label?: string; cost?: number | null } | string | null;
    }) ?? {};
  // `pagamento` já foi gravado como string ("cartao") e como objeto.
  const pagamentoObj =
    typeof o.pagamento === "string"
      ? { metodo: o.pagamento }
      : ((o.pagamento as { metodo?: string; parcelas?: number; valorParcela?: number }) ?? {});
  const endereco = parseAddress(entregaObj.endereco);
  const frete =
    typeof entregaObj.frete === "string"
      ? entregaObj.frete
      : (entregaObj.frete?.label ?? undefined);
  const freteValor =
    typeof entregaObj.frete === "object" && entregaObj.frete !== null
      ? (entregaObj.frete.cost ?? null)
      : null;
  return {
    itens: produtos,
    nome: cliente.nome ?? "—",
    telefone: cliente.telefone ?? "—",
    cidade: cliente.cidade ?? endereco?.cidade,
    entrega: entregaObj.metodo === "entrega" ? ("entrega" as const) : ("retirada" as const),
    endereco,
    frete,
    freteValor,
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
    endereco: parsed.endereco?.linha,
    enderecoDetalhe: parsed.endereco,
    frete: parsed.frete,
    freteStatus: (row.frete_status as AdminOrder["freteStatus"]) ?? "pendente",
    freteValor: parsed.freteValor,
    pagamento: parsed.pagamento,
    status,
    pagamentoEstado: mapPaymentState(row.pagamento_estado),
    valorDevolvido: Number(row.valor_devolvido ?? 0) || 0,
    observacoes: parsed.observacoes,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    responsavel: row.atendente_nome ?? undefined,
    responsavelId: row.responsavel_id ?? undefined,
    atribuidoEm: row.atribuido_em ?? undefined,
    canal: row.canal ?? undefined,
    historico: (row.pedido_status_historico ?? [])
      .slice()
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
      .map((h) => ({
        status: mapStatus(h.para),
        at: h.criado_em,
        by: h.por_usuario ?? undefined,
        note: h.observacao ?? undefined,
      })),
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
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (data ?? [])
      .map((r) => mapDbRole(String(r.role)))
      .filter((r): r is EmployeeRole => Boolean(r));
    const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
    return {
      userId: user.id,
      roles,
      displayName: meta.full_name ?? meta.name ?? user.email ?? undefined,
      email: user.email ?? undefined,
    };
  },

  async listOrders(): Promise<AdminOrder[]> {
    const { data, error } = await supabase
      .from("pedidos")
      .select(
        "id, numero_pedido, itens, valor_total, status, canal, criado_em, atualizado_em, atendente_nome, responsavel_id, atribuido_em, pagamento_estado, valor_devolvido, frete_status, pedido_status_historico ( de, para, criado_em, observacao, por_usuario )",
      )
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => mapRow(r as PedidoRow));
  },

  async transitionOrder(id: string, status: OrderStatus): Promise<void> {
    // Chamada única: o banco valida transição, consome/estorna estoque e
    // registra histórico dentro da mesma transação (SELECT ... FOR UPDATE
    // em pedido e variações). O cliente NÃO decide mais o que consumir.
    // O responsável é derivado de `auth.uid()` no servidor (Onda 1.1 · item 8).
    const { error } = await supabase.rpc("transicionar_pedido", {
      p_pedido_id: id,
      p_novo_status: status,
    });
    if (error) throw error;
  },

  async cancelOrderWithRefund(id: string, motivo?: string): Promise<void> {
    // Estorno no ledger + devolução de estoque + status cancelado numa única
    // transação no banco. Exclusivo do Admin Master (validado no servidor).
    const { error } = await supabase.rpc("cancelar_pedido_com_estorno", {
      p_pedido_id: id,
      p_motivo: motivo ?? null,
    });
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
          nome: "",
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
    // Enriquecer com dados do profiles (respeita RLS — admin vê todos).
    const ids = Array.from(seen.keys());
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome, telefone, status, ultimo_acesso")
        .in("user_id", ids);
      for (const p of profs ?? []) {
        const emp = seen.get(String(p.user_id));
        if (!emp) continue;
        if (p.nome) emp.nome = String(p.nome);
        if (p.telefone) emp.login = String(p.telefone);
        if (p.status === "inativo") {
          emp.status = "inativo";
          emp.ativo = false;
        }
        if (p.ultimo_acesso) emp.ultimoAcesso = String(p.ultimo_acesso);
      }
    }
    // Fallback do nome para os primeiros 8 chars do id quando o perfil ainda
    // não foi preenchido, garantindo linha legível na tabela.
    for (const emp of seen.values()) {
      if (!emp.nome) emp.nome = emp.id.slice(0, 8);
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
        "id, sku, slug, nome, marca, categoria, colecao, cor, descricao, imagens, preco, ativo, destaque, modelo_estoque, arquivado_em, criado_em, atualizado_em, produto_variacoes ( tamanho, quantidade )",
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
    const { error } = await supabase.from("produtos").update(toProductInsert(p)).eq("id", id);
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
    // Ajuste atômico via RPC no banco: bloqueia a linha, valida, registra
    // movimentação de auditoria numa única transação. Nenhum cálculo de
    // delta acontece no cliente (fim da corrida entre abas).
    const nextQty = Math.max(0, Math.floor(quantidade));
    const { error } = await supabase.rpc("ajustar_estoque", {
      p_produto_id: productId,
      p_tamanho: tamanho,
      p_tipo: kind,
      p_qty: nextQty,
      p_observacao: observacao,
      p_pedido_id: undefined,
    });
    if (error) throw error;
  },

  async listKitComposition(kitId: string): Promise<KitAvailability[]> {
    // Composição + saldo real das peças numa consulta só (sem N+1).
    const { data, error } = await supabase
      .from("produto_kit_itens")
      .select(
        "id, kit_id, kit_tamanho, componente_id, componente_tamanho, quantidade, produtos!produto_kit_itens_componente_id_fkey ( sku, nome )",
      )
      .eq("kit_id", kitId)
      .order("kit_tamanho", { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as unknown as KitItemRow[];
    const componentIds = [...new Set(rows.map((r) => r.componente_id))];
    const disponivel = new Map<string, number>();
    if (componentIds.length > 0) {
      const { data: vars, error: varsError } = await supabase
        .from("produto_variacoes")
        .select("produto_id, tamanho, disponivel")
        .in("produto_id", componentIds);
      if (varsError) throw varsError;
      for (const v of vars ?? []) {
        disponivel.set(`${v.produto_id}||${v.tamanho}`, Math.max(0, v.disponivel ?? 0));
      }
    }

    const bySize = new Map<string, KitComponent[]>();
    for (const r of rows) {
      const component: KitComponent = {
        id: r.id,
        kitId: r.kit_id,
        kitSize: r.kit_tamanho,
        componentId: r.componente_id,
        componentSku: r.produtos?.sku ?? "—",
        componentName: r.produtos?.nome ?? "Peça removida",
        componentSize: r.componente_tamanho,
        quantity: r.quantidade,
        componentAvailable: disponivel.get(`${r.componente_id}||${r.componente_tamanho}`) ?? 0,
      };
      const list = bySize.get(r.kit_tamanho) ?? [];
      list.push(component);
      bySize.set(r.kit_tamanho, list);
    }

    return [...bySize.entries()].map(([kitSize, components]) => ({
      kitSize,
      // Mesma regra do banco (`kit_disponivel`): o kit vale o elo mais fraco.
      available: components.reduce(
        (min, c) => Math.min(min, Math.floor(c.componentAvailable / c.quantity)),
        Number.POSITIVE_INFINITY,
      ),
      components,
    }));
  },

  async addKitComponent(p: KitComponentWritePayload): Promise<void> {
    const { error } = await supabase.from("produto_kit_itens").insert({
      kit_id: p.kitId,
      kit_tamanho: p.kitSize,
      componente_id: p.componentId,
      componente_tamanho: p.componentSize,
      quantidade: p.quantity,
    });
    if (error) throw error;
  },

  async removeKitComponent(id: string): Promise<void> {
    const { error } = await supabase.from("produto_kit_itens").delete().eq("id", id);
    if (error) throw error;
  },
};

interface KitItemRow {
  id: string;
  kit_id: string;
  kit_tamanho: string;
  componente_id: string;
  componente_tamanho: string;
  quantidade: number;
  produtos: { sku: string; nome: string } | null;
}

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
  modelo_estoque?: string | null;
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
    stockModel:
      row.modelo_estoque === "kit" || row.modelo_estoque === "multi_variante"
        ? row.modelo_estoque
        : "peca_unica",
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
    if (!current) {
      // Cria a variação com estoque zero — quantidade > 0 vai via RPC abaixo,
      // que registra a movimentação de auditoria.
      const { error } = await supabase
        .from("produto_variacoes")
        .insert({ produto_id: productId, tamanho: d.tamanho, quantidade: 0 });
      if (error) throw error;
    }
    // Ajusta o estoque via RPC (idempotente: se já está no valor desejado,
    // o delta é zero e nada é gravado em movimentações).
    if (!current || current.quantidade !== qty) {
      const { error } = await supabase.rpc("ajustar_estoque", {
        p_produto_id: productId,
        p_tamanho: d.tamanho,
        p_tipo: "ajuste",
        p_qty: qty,
        p_observacao: "Ajuste via edição de produto",
      });
      if (error) throw error;
    }
  }
}
