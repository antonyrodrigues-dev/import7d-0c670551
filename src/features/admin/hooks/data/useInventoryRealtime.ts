import { useEffect, useRef } from "react";
import { adminDataSource } from "../../adapters";

/**
 * Sincronização em tempo real do catálogo/estoque. Uma única assinatura por
 * consumidor; o callback mais recente é sempre usado, sem recriar o canal.
 */
export function useInventoryRealtime(onChange: () => void, enabled = true): void {
  const ref = useRef(onChange);
  ref.current = onChange;

  useEffect(() => {
    if (!enabled) return;
    return adminDataSource.subscribeInventory(() => ref.current());
  }, [enabled]);
}
