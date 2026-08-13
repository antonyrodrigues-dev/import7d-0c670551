/**
 * 7D IMPORTS — Livro-razão financeiro (append-only).
 *
 * O ledger é a fonte única do financeiro: receitas nascem da confirmação de
 * pagamento e estornos nascem de devolução ou estorno. Nada é calculado aqui;
 * o serviço apenas lê a tabela imutável `financeiro_lancamentos`.
 */

import { opsDataSource } from "../../adapters/ops";
import { handleAdminError } from "../../lib/errors";
import type { LedgerEntry } from "../../types";

export async function listLedger(pedidoId: string): Promise<LedgerEntry[]> {
  try {
    return await opsDataSource.listLedger(pedidoId);
  } catch (e) {
    handleAdminError(e, "ledger.listLedger");
    return [];
  }
}

/** Saldo líquido lançado (receitas − estornos) de um pedido. */
export function ledgerBalance(entries: LedgerEntry[]): number {
  return Math.round(entries.reduce((acc, e) => acc + e.valor, 0) * 100) / 100;
}
