import { useEffect } from "react";
import { toast } from "sonner";
import { useInventoryStore } from "../../stores/inventory";

export function useInventory(options: { auto?: boolean } = { auto: true }) {
  const store = useInventoryStore();
  useEffect(() => {
    if (options.auto) {
      void store.refresh().catch((e: Error) => toast.error(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return store;
}
