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

export async function loadParams(): Promise<OperationalParams> {
  try {
    return await opsDataSource.getParams();
  } catch (e) {
    handleAdminError(e, "params.loadParams");
    return { ...DEFAULT_PARAMS };
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
