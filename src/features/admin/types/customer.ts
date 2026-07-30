import type { IsoDateTime } from "./common";

export interface CustomerOrderRef {
  id: string;
  numero: string;
  criadoEm: IsoDateTime;
  valorTotal: number;
}

export interface AdminCustomer {
  id: string;
  nome: string;
  telefone: string;
  cidade: string;
  estado?: string;
  historico: CustomerOrderRef[];
  pedidos: number;
  ultimaCompra: IsoDateTime | null;
  valorGasto: number;
  observacoes?: string;
  status: "ativo" | "inativo";
}
