import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function NetworkStatusWatcher() {
  const wasOffline = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOffline = () => {
      wasOffline.current = true;
      toast.error("Sem conexão", {
        id: "net-offline",
        description: "Verifique sua internet. As ações serão retomadas quando reconectar.",
        duration: Infinity,
      });
    };
    const onOnline = () => {
      if (!wasOffline.current) return;
      wasOffline.current = false;
      toast.dismiss("net-offline");
      toast.success("Conexão restabelecida", { id: "net-online", duration: 2400 });
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
