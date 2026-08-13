/**
 * Serviço de parâmetros operacionais.
 *
 * Limites são validados no banco (`definir_parametro`) e espelhados aqui
 * apenas para feedback imediato. Toda alteração registra autor, data e
 * notificação persistente.
 */

import { opsDataSource } from "../../adapters/ops";
import { createAdminError, handleAdminError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import type { OperationalParamKey, OperationalParams } from "../../types";
import { DEFAULT_PARAMS, PARAM_LIMITS } from "../../types";
import type { CheckoutBlock } from "../../types";

export async function loadParams(): Promise<OperationalParams> {
  try {
    return await opsDataSource.getParams();
  } catch (e) {
    handleAdminError(e, "params.loadParams");
    return { ...DEFAULT_PARAMS };
  }
}

/**
 * Tentativas de checkout recusadas pela proteção anti-abuso.
 * A RLS libera a leitura apenas ao Admin Master; para os demais a lista
 * simplesmente volta vazia, sem quebrar a tela.
 */
export async function loadCheckoutBlocks(limit = 50): Promise<CheckoutBlock[]> {
  try {
    return await opsDataSource.listCheckoutBlocks(limit);
  } catch (e) {
    handleAdminError(e, "params.loadCheckoutBlocks");
    return [];
  }
}

export function validateParam(key: OperationalParamKey, value: number): string | null {
  const limit = PARAM_LIMITS[key];
  if (!Number.isInteger(value)) return `Informe um número inteiro de ${limit.unidade}.`;
  if (value < limit.min || value > limit.max)
    return `${limit.label} deve ficar entre ${limit.min} e ${limit.max} ${limit.unidade}.`;
  return null;
}

export async function saveParam(key: OperationalParamKey, value: number): Promise<boolean> {
  const invalid = validateParam(key, value);
  if (invalid) {
    handleAdminError(
      createAdminError("validation", invalid, "params.saveParam"),
      "params.saveParam",
    );
    return false;
  }
  try {
    await opsDataSource.setParam(PARAM_LIMITS[key].chave, value);
    logger.info("Parâmetro operacional alterado.", { key, value, origin: "params.service" });
    return true;
  } catch (e) {
    handleAdminError(e, "params.saveParam");
    return false;
  }
}
