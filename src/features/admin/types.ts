/**
 * 7D IMPORTS — Tipagem oficial do módulo administrativo.
 *
 * Todo módulo (Dashboard, Pedidos, Estoque, Clientes, Funcionários,
 * Notificações, Configurações) consome estes tipos. Alterar aqui propaga
 * automaticamente. Nenhuma tela pode declarar shape duplicado.
 */

export type AdminNavKey =
  | "dashboard"
  | "pedidos"
  | "estoque"
  | "clientes"
  | "funcionarios"
  | "configuracoes"
  | "notificacoes";

export type OrderStatus =
  | "novo"
  | "separado"
  | "reservado"
  | "aguardando_retirada"
  | "enviado"
  | "finalizado"
  | "cancelado";

export type EmployeeRole = "admin" | "vendedor";

export type Permission =
  | "orders:view"
  | "orders:edit"
  | "inventory:view"
  | "inventory:edit"
  | "customers:view"
  | "customers:edit"
  | "employees:view"
  | "employees:edit"
  | "settings:view"
  | "settings:edit"
  | "notifications:view"
  | "notifications:edit";

export interface AdminOrderItem {
  slug: string;
  name: string;
  price: number;
  size: string;
  quantity: number;
  image?: string;
}

export interface AdminOrder {
  id: string;
  numero: string;
  cliente: {
    nome: string;
    telefone: string;
  };
  itens: AdminOrderItem[];
  valorTotal: number;
  entrega: "entrega" | "retirada";
  pagamento: string;
  status: OrderStatus;
  criadoEm: string;
  atualizadoEm: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  color: string;
  sizes: string[];
  quantity: number;
  price: number;
  image: string;
  active: boolean;
  featured: boolean;
}

export interface AdminCustomer {
  id: string;
  nome: string;
  telefone: string;
  cidade: string;
  pedidos: number;
  ultimaCompra: string | null;
  valorGasto: number;
  status: "ativo" | "inativo";
}

export interface Employee {
  id: string;
  nome: string;
  email: string;
  role: EmployeeRole;
  ativo: boolean;
}

export type NotificationKind =
  | "pedido_novo"
  | "estoque_baixo"
  | "erro_sistema"
  | "atualizacao"
  | "aviso"
  | "suporte";

export interface AdminNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface AdminSettings {
  whatsapp: string;
  instagram: string;
  facebook: string;
  endereco: string;
  cep: string;
  cidade: string;
  horarioFuncionamento: string;
  horarioRetirada: string;
  parcelamentoMax: number;
  textoHero: string;
  textoManifesto: string;
  telefone: string;
  email: string;
  logoUrl: string;
  videoHeroUrl: string;
  bannerHeroUrl: string;
  itensDestaque: string[];
}

export interface DashboardMetrics {
  pedidosHoje: number;
  pedidosPendentes: number;
  pedidosFinalizados: number;
  clientes: number;
  produtos: number;
  estoqueBaixo: number;
  reservasEmAndamento: number;
  ticketMedio: number;
  faturamentoDia: number;
  faturamentoMes: number;
}

export type AsyncState = "idle" | "loading" | "ready" | "error";