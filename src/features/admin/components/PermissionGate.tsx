/**
 * 7D IMPORTS — PermissionGate.
 *
 * Componente único de gate visual por permissão. Cada rota administrativa
 * envolve o próprio conteúdo com este gate; a UI de "acesso restrito" é
 * padronizada e nenhuma rota duplica lógica de autorização.
 */

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { EmptyState } from "./AdminUI";
import { usePermissions } from "../hooks";
import type { Permission } from "../types";

interface PermissionGateProps {
  /** Permissão exigida para renderizar `children`. */
  perm: Permission;
  /** Título mostrado no PageHeader do bloqueio (default: "Painel"). */
  title?: string;
  /** Descrição mostrada dentro do EmptyState. */
  restrictedDescription?: string;
  children: ReactNode;
}

export function PermissionGate({
  perm,
  title = "Painel",
  restrictedDescription = "Você não tem permissão para acessar este módulo. Solicite acesso ao Administrador Master.",
  children,
}: PermissionGateProps) {
  const { ready, can } = usePermissions();

  // Aguarda a hidratação da identidade para evitar flash de "acesso restrito".
  if (!ready) return null;

  if (!can(perm)) {
    return (
      <>
        <PageHeader eyebrow="Painel" title={title} />
        <EmptyState
          icon={<Lock className="h-5 w-5" />}
          title="Acesso restrito"
          description={restrictedDescription}
        />
      </>
    );
  }

  return <>{children}</>;
}
