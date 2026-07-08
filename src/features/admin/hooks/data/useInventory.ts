import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useInventoryStore } from "../../stores/inventory";
import {
  archiveProduct,
  createProduct,
  deleteProduct,
  duplicateProduct,
  registerMovement,
  restoreProduct,
  updateProduct,
} from "../../services/inventory.service";
import type { ProductWritePayload } from "../../adapters/types";
import type { InventoryItem, MovementKind } from "../../types";

export function useInventory(options: { auto?: boolean } = { auto: true }) {
  const store = useInventoryStore();
  useEffect(() => {
    if (options.auto) {
      void store.refresh().catch((e: Error) => toast.error(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = store.refresh;

  const create = useCallback(
    async (p: ProductWritePayload) => {
      const id = await createProduct(p);
      toast.success("Produto criado.");
      await refresh();
      return id;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, p: ProductWritePayload) => {
      await updateProduct(id, p);
      toast.success("Produto atualizado.");
      await refresh();
    },
    [refresh],
  );

  const duplicate = useCallback(
    async (item: InventoryItem) => {
      const id = await duplicateProduct(item);
      toast.success("Produto duplicado (inativo).");
      await refresh();
      return id;
    },
    [refresh],
  );

  const archive = useCallback(
    async (id: string) => {
      await archiveProduct(id);
      toast.success("Produto arquivado.");
      await refresh();
    },
    [refresh],
  );

  const restore = useCallback(
    async (id: string) => {
      await restoreProduct(id);
      toast.success("Produto reativado.");
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteProduct(id);
      toast.success("Produto excluído.");
      await refresh();
    },
    [refresh],
  );

  const adjustStock = useCallback(
    async (kind: MovementKind, productId: string, size: string, qty: number) => {
      await registerMovement(kind, productId, size, qty);
      toast.success("Estoque ajustado.");
      await refresh();
    },
    [refresh],
  );

  return {
    ...store,
    create,
    update,
    duplicate,
    archive,
    restore,
    remove,
    adjustStock,
  };
}
