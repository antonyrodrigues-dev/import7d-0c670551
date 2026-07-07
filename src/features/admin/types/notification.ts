import type { IsoDateTime } from "./common";

export type NotificationKind =
  | "pedido_novo"
  | "estoque_baixo"
  | "erro_sistema"
  | "atualizacao"
  | "aviso"
  | "suporte";

export type NotificationPriority = "baixa" | "media" | "alta" | "critica";

export interface AdminNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  priority: NotificationPriority;
  createdAt: IsoDateTime;
  read: boolean;
}