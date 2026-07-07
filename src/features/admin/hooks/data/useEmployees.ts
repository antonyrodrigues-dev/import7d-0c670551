import { useEffect } from "react";
import { toast } from "sonner";
import { useEmployeesStore } from "../../stores/employees";
import { usePermissions } from "../usePermissions";

export function useEmployees() {
  const store = useEmployeesStore();
  const { can, ready } = usePermissions();
  useEffect(() => {
    if (ready && can("employees:view")) {
      void store.refresh().catch((e: Error) => toast.error(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return store;
}
