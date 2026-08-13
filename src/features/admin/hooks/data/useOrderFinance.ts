import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { listPayments, registerPayment, requiresAdmin } from "../../services/ops/payments.service";
import { listReturns, registerReturn } from "../../services/ops/returns.service";
import { ledgerBalance, listLedger } from "../../services/ops/ledger.service";
import { nextPaymentStates } from "../../lib/paymentMachine";
import type {
  AdminAsyncState,
  LedgerEntry,
  PaymentEntry,
  PaymentState,
  ReturnInput,
  ReturnRecord,
} from "../../types";

/**
 * Pagamentos e devoluções de um pedido específico. Ambos os fluxos são
 * transacionais no banco; aqui só orquestramos loading, sucesso e refresh.
 */
export function useOrderFinance(pedidoId: string | null) {
  const [state, setState] = useState<AdminAsyncState>("idle");
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const refresh = useCallback(async () => {
    if (!pedidoId) {
      setPayments([]);
      setReturns([]);
      setLedger([]);
      setState("idle");
      return;
    }
    setState("loading");
    const [p, d, l] = await Promise.all([
      listPayments(pedidoId),
      listReturns(pedidoId),
      listLedger(pedidoId),
    ]);
    setPayments(p);
    setReturns(d);
    setLedger(l);
    setState(p.length + d.length + l.length === 0 ? "empty" : "ready");
  }, [pedidoId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const alterarPagamento = useCallback(
    async (estado: PaymentState, extras?: { comprovanteUrl?: string; observacao?: string }) => {
      if (!pedidoId) return false;
      setState("saving");
      const ok = await registerPayment({
        pedidoId,
        estado,
        comprovanteUrl: extras?.comprovanteUrl ?? null,
        observacao: extras?.observacao ?? null,
      });
      if (ok) toast.success("Pagamento atualizado.");
      await refresh();
      return ok;
    },
    [pedidoId, refresh],
  );

  const registrarDevolucao = useCallback(
    async (input: Omit<ReturnInput, "pedidoId">) => {
      if (!pedidoId) return false;
      setState("saving");
      const id = await registerReturn({ ...input, pedidoId });
      if (id) toast.success("Devolução registrada.");
      await refresh();
      return Boolean(id);
    },
    [pedidoId, refresh],
  );

  return {
    state,
    payments,
    returns,
    ledger,
    saldoLedger: ledgerBalance(ledger),
    refresh,
    alterarPagamento,
    registrarDevolucao,
    requiresAdmin,
    nextPaymentStates,
  };
}
