/**
 * 7D IMPORTS — Aplicação do snapshot OFICIAL do servidor ao pedido local.
 *
 * A RPC `criar_pedido` recalcula tudo no banco (nome, imagem, preço, subtotal,
 * total, entrega, pagamento). Esta função é a ÚNICA tradução desse snapshot
 * para o objeto `Order` usado na mensagem do WhatsApp e no painel pendente.
 *
 * Regra dura: nenhum dado de apresentação vindo do localStorage sobrevive —
 * itens, valores, entrega e pagamento são substituídos pelo snapshot.
 */

import type { Order } from "@/lib/order";
import type { OrderPickup } from "@/lib/order";
import type { Address, DeliveryMethod, PaymentMethod } from "@/lib/checkout";
import type { PendingOrder } from "@/store/checkout";

export interface CriarPedidoRow {
  id?: string | null;
  numero_pedido?: string | null;
  valor_total?: number | string | null;
  frete_status?: string | null;
  snapshot?: unknown;
}

interface SnapshotShape {
  produtos?: {
    slug?: string;
    name?: string;
    size?: string;
    quantity?: number | string;
    price?: number | string;
    image?: string | null;
  }[];
  subtotal?: number | string;
  entrega?: { metodo?: string; endereco?: Address | null; retirada?: OrderPickup | null };
  pagamento?: { metodo?: string; parcelas?: number | string };
}

export interface OfficialOrderResult {
  order: Order;
  pending: PendingOrder;
}

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * @throws Error quando a resposta do servidor não contém id, número ou itens.
 */
export function applyOfficialSnapshot(localOrder: Order, row: CriarPedidoRow): OfficialOrderResult {
  if (!row?.id || !row?.numero_pedido) {
    throw new Error("Resposta inválida do servidor.");
  }
  const snap = (row.snapshot ?? {}) as SnapshotShape;

  const itens = (snap.produtos ?? [])
    .map((p) => ({
      slug: String(p.slug ?? ""),
      name: String(p.name ?? ""),
      size: String(p.size ?? ""),
      quantity: num(p.quantity),
      price: num(p.price),
      image: p.image ?? "",
    }))
    .filter((i) => i.slug && i.size && i.quantity > 0);
  if (itens.length === 0) throw new Error("Snapshot oficial vazio.");

  const total = num(row.valor_total);
  const subtotal = num(snap.subtotal, total);
  const metodoEntrega = (snap.entrega?.metodo ?? localOrder.entrega.metodo) as DeliveryMethod;
  const metodoPagamento = (snap.pagamento?.metodo ?? localOrder.pagamento.metodo) as PaymentMethod;
  const parcelas = Math.max(1, num(snap.pagamento?.parcelas, 1));
  const endereco = (snap.entrega?.endereco ?? undefined) as Address | undefined;
  const retirada = (snap.entrega?.retirada ?? undefined) as OrderPickup | undefined;

  const order: Order = {
    ...localOrder,
    numero: String(row.numero_pedido),
    itens,
    entrega: {
      ...localOrder.entrega,
      metodo: metodoEntrega,
      endereco: metodoEntrega === "entrega" ? endereco : undefined,
      retirada: metodoEntrega === "retirada" ? retirada : undefined,
      // Frete do MVP é sempre combinado com a equipe; servidor não precifica.
      frete: { cost: null, label: "A combinar" },
    },
    pagamento: {
      ...localOrder.pagamento,
      metodo: metodoPagamento,
      parcelas,
      parcelamento: metodoPagamento === "credito" ? localOrder.pagamento.parcelamento : null,
    },
    totais: { subtotal, frete: 0, total: total || subtotal },
  };

  const pending: PendingOrder = {
    id: String(row.id),
    numero: order.numero,
    url: "",
    criadoEm: order.criadoEm,
    summary: {
      itens: order.itens.map((i) => ({ ...i })),
      subtotalOficial: subtotal,
      entrega: order.entrega.metodo,
      endereco: order.entrega.endereco,
      retirada: order.entrega.retirada ?? null,
      freteLabel: order.entrega.metodo === "entrega" ? "A combinar" : "Retirada na loja",
      pagamento: order.pagamento.metodo,
      parcelas: order.pagamento.parcelas,
    },
  };

  return { order, pending };
}
