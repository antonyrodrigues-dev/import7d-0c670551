/**
 * Serviço de estoque — persistência real via `AdminDataSource`.
 *
 * A UI nunca conversa com o adapter diretamente: passa por aqui.
 * Este serviço é o único ponto que traduz intenções de negócio
 * ("arquivar produto", "ajustar estoque") em chamadas de persistência.
 */

import { adminDataSource } from "../adapters";
import type { ProductWritePayload, MovementKindDB } from "../adapters/types";
import type { AdminOrder, InventoryItem, MovementKind } from "../types";
import { useInventoryStore } from "../stores/inventory";
import { handleAdminError } from "../lib/errors";
import { logger } from "../lib/logger";

export function listInventory(): Promise<InventoryItem[]> {
  return adminDataSource.listInventory().catch((e) => {
    throw handleAdminError(e, "inventory.service.list");
  });
}

export async function createProduct(p: ProductWritePayload): Promise<string> {
  try {
    const id = await adminDataSource.createProduct(p);
    logger.info(`Produto criado: ${p.sku} — ${p.nome}`, {
      kind: "stock.in",
      productId: id,
    });
    return id;
  } catch (e) {
    throw handleAdminError(e, "inventory.service.create");
  }
}

export async function updateProduct(id: string, p: ProductWritePayload): Promise<void> {
  try {
    await adminDataSource.updateProduct(id, p);
    logger.info(`Produto atualizado: ${p.sku}`, { kind: "stock.adjust", productId: id });
  } catch (e) {
    throw handleAdminError(e, "inventory.service.update");
  }
}

export async function archiveProduct(id: string): Promise<void> {
  try {
    await adminDataSource.archiveProduct(id);
    logger.warn(`Produto arquivado`, { kind: "stock.adjust", productId: id });
  } catch (e) {
    throw handleAdminError(e, "inventory.service.archive");
  }
}

export async function restoreProduct(id: string): Promise<void> {
  try {
    await adminDataSource.restoreProduct(id);
    logger.info(`Produto restaurado`, { kind: "stock.adjust", productId: id });
  } catch (e) {
    throw handleAdminError(e, "inventory.service.restore");
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    await adminDataSource.deleteProduct(id);
    logger.security(`Produto excluído em definitivo`, { productId: id });
  } catch (e) {
    throw handleAdminError(e, "inventory.service.delete");
  }
}

/**
 * Duplica um produto: novo SKU / slug sufixado com `-copia`, mesmas variações,
 * mas com estoque zerado (a cópia começa vazia até o operador conferir).
 */
export async function duplicateProduct(item: InventoryItem): Promise<string> {
  const p: ProductWritePayload = {
    sku: `${item.sku}-COPIA`,
    slug: `${item.slug}-copia`,
    nome: `${item.name} (cópia)`,
    marca: item.brand,
    categoria: item.category,
    cor: item.color === "—" ? null : item.color,
    colecao: item.collection ?? null,
    descricao: item.description ?? null,
    imagens: [...item.images],
    preco: item.price,
    ativo: false, // cópia começa inativa por segurança
    destaque: false,
    variacoes: item.stockBySize.map((s) => ({ tamanho: s.size, quantidade: 0 })),
  };
  return createProduct(p);
}

/**
 * Ajusta o estoque de UMA variação. Toda mutação passa por aqui — o adapter
 * calcula o delta, atualiza a variação e grava uma linha em
 * `produto_movimentacoes` para auditoria permanente.
 */
export async function registerMovement(
  kind: MovementKind,
  productId: string,
  size: string,
  qty: number,
  observacao?: string,
): Promise<void> {
  try {
    // Contrato da RPC `ajustar_estoque`:
    //   - ajuste                              → p_qty = valor ABSOLUTO final
    //   - entrada | reposicao | saida | consumo_pedido → p_qty = DELTA (magnitude positiva)
    // O banco aplica a soma/subtração atomicamente e valida invariantes.
    // Nenhum cálculo de delta acontece aqui — evita corrida entre abas.
    if (qty < 0) throw new Error("Quantidade não pode ser negativa.");
    const dbKind: MovementKindDB = kind;
    await adminDataSource.setVariationStock(productId, size, qty, dbKind, observacao);
  } catch (e) {
    throw handleAdminError(e, "inventory.service.registerMovement");
  }
}

/**
 * Aplica consumo derivado de um pedido. Idempotente por pedido em memória
 * (evita duplicar chamada se transitionOrderStatus for reprocessado).
 * O consumo real no banco é registrado como `consumo_pedido`.
 */
export async function registerConsumption(order: AdminOrder): Promise<void> {
  const store = useInventoryStore.getState();
  if (store.consumedOrderIds[order.id]) return;
  store.markConsumed(order.id);
  for (const it of order.itens) {
    const item = store.items.find((i) => i.slug === it.slug);
    if (!item) continue;
    const qty = it.quantity ?? 0;
    if (qty <= 0) continue;
    try {
      await adminDataSource.setVariationStock(
        item.id,
        it.size,
        qty, // DELTA — RPC subtrai atomicamente com kind consumo_pedido
        "consumo_pedido",
        `Pedido ${order.numero}`,
      );
    } catch (e) {
      handleAdminError(e, "inventory.service.consume");
    }
  }
}

/**
 * Restaura o estoque consumido por um pedido (aplicado no cancelamento após
 * o consumo já ter sido feito). Idempotente: se o pedido não foi consumido,
 * nada acontece.
 */
export async function restoreConsumption(order: AdminOrder): Promise<void> {
  const store = useInventoryStore.getState();
  if (!store.consumedOrderIds[order.id]) return;
  store.unmarkConsumed(order.id);
  for (const it of order.itens) {
    const item = store.items.find((i) => i.slug === it.slug);
    if (!item) continue;
    const qty = it.quantity ?? 0;
    if (qty <= 0) continue;
    try {
      await adminDataSource.setVariationStock(
        item.id,
        it.size,
        qty, // DELTA — kind entrada devolve a quantidade consumida atomicamente
        "entrada",
        `Estorno do pedido ${order.numero}`,
      );
      logger.info(`Estoque restaurado (pedido ${order.numero}): ${it.slug} ${it.size} +${it.quantity}`, {
        kind: "stock.adjust",
        productId: item.id,
      });
    } catch (e) {
      handleAdminError(e, "inventory.service.restore");
    }
  }
}
