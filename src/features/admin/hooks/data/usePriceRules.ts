import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { applyPriceRule, listPriceRules, previewPriceRule } from "../../services/pricing.service";
import type { AdminAsyncState, PriceRule, PriceRuleInput, PriceRulePreview } from "../../types";

/** Ciclo de vida das regras de preço por categoria (Admin Master). */
export function usePriceRules(enabled = true) {
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [state, setState] = useState<AdminAsyncState>("idle");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setState("loading");
    try {
      setRules(await listPriceRules());
      setError(null);
      setState("ready");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const preview = useCallback(
    async (category: string, includeConfirmed: boolean): Promise<PriceRulePreview | null> => {
      try {
        return await previewPriceRule(category, includeConfirmed);
      } catch (e) {
        toast.error((e as Error).message);
        return null;
      }
    },
    [],
  );

  const apply = useCallback(
    async (input: PriceRuleInput): Promise<number | null> => {
      try {
        const res = await applyPriceRule(input);
        toast.success(
          res.affected === 0
            ? "Regra salva. Nenhum produto precisou ser alterado."
            : `Regra aplicada a ${res.affected} produto(s) de ${input.category}.`,
        );
        await refresh();
        return res.affected;
      } catch (e) {
        toast.error((e as Error).message);
        return null;
      }
    },
    [refresh],
  );

  return { rules, state, error, refresh, preview, apply };
}
