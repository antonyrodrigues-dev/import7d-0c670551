/**
 * Serviço de kits — composição e disponibilidade derivada.
 *
 * Regra de negócio única: um kit NÃO possui saldo próprio. A quantidade
 * vendável de cada tamanho do kit é o menor múltiplo completo entre as peças
 * que o compõem. O banco aplica exatamente a mesma fórmula
 * (`public.kit_disponivel`); aqui a conta existe só para a leitura da UI.
 */

import { adminDataSource } from "../adapters";
import type { KitComponentWritePayload } from "../adapters/types";
import type { InventoryItem, KitAvailability } from "../types";
import { handleAdminError } from "../lib/errors";
import { logger } from "../lib/logger";

export function listKitComposition(kitId: string): Promise<KitAvailability[]> {
  return adminDataSource.listKitComposition(kitId).catch((e) => {
    throw handleAdminError(e, "kits.service.list");
  });
}

/** Peças elegíveis a compor um kit: qualquer produto que não seja kit. */
export function eligibleComponents(items: InventoryItem[], kitId: string): InventoryItem[] {
  return items
    .filter((i) => i.id !== kitId && i.stockModel !== "kit" && i.stockBySize.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function addKitComponent(p: KitComponentWritePayload): Promise<void> {
  if (!Number.isInteger(p.quantity) || p.quantity < 1 || p.quantity > 20) {
    throw handleAdminError(
      new Error("Quantidade por kit deve ficar entre 1 e 20."),
      "kits.service.add",
    );
  }
  try {
    await adminDataSource.addKitComponent(p);
    logger.info(`Peça adicionada ao kit (tam ${p.kitSize})`, {
      kind: "stock.adjust",
      productId: p.kitId,
    });
  } catch (e) {
    throw handleAdminError(e, "kits.service.add");
  }
}

export async function removeKitComponent(id: string, kitId: string): Promise<void> {
  try {
    await adminDataSource.removeKitComponent(id);
    logger.warn("Peça removida da composição do kit", { kind: "stock.adjust", productId: kitId });
  } catch (e) {
    throw handleAdminError(e, "kits.service.remove");
  }
}
