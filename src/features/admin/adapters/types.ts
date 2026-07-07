/**
 * Contrato do "backend" do painel administrativo.
 *
 * Serviços do admin dependem apenas desta interface — não conhecem qual
 * origem de dados atende (Lovable Cloud hoje, REST próprio no futuro,
 * fila em memória para testes). Trocar a origem só edita este diretório.
 */

import type {
  AdminOrder,
  Employee,
  EmployeeRole,
  OrderStatus,
} from "../types";

export interface AdminIdentity {
  userId: string | null;
  roles: EmployeeRole[];
}

export interface AdminDataSource {
  // Identidade / autorização
  currentIdentity(): Promise<AdminIdentity>;

  // Pedidos
  listOrders(): Promise<AdminOrder[]>;
  updateOrderStatus(id: string, status: OrderStatus): Promise<void>;

  // Funcionários
  listEmployees(): Promise<Employee[]>;
}