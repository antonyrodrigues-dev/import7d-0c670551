export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      pedido_status_historico: {
        Row: {
          criado_em: string
          de: string | null
          id: string
          observacao: string | null
          para: string
          pedido_id: string
          por_usuario: string | null
        }
        Insert: {
          criado_em?: string
          de?: string | null
          id?: string
          observacao?: string | null
          para: string
          pedido_id: string
          por_usuario?: string | null
        }
        Update: {
          criado_em?: string
          de?: string | null
          id?: string
          observacao?: string | null
          para?: string
          pedido_id?: string
          por_usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_status_historico_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_transicoes: {
        Row: {
          de: string
          para: string
        }
        Insert: {
          de: string
          para: string
        }
        Update: {
          de?: string
          para?: string
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          atendente_nome: string | null
          atualizado_em: string
          canal: string
          consumo_aplicado: boolean
          criado_em: string
          frete_status: string
          id: string
          idempotency_key: string | null
          itens: Json
          numero_pedido: string
          status: string
          valor_total: number
        }
        Insert: {
          atendente_nome?: string | null
          atualizado_em?: string
          canal?: string
          consumo_aplicado?: boolean
          criado_em?: string
          frete_status?: string
          id?: string
          idempotency_key?: string | null
          itens: Json
          numero_pedido?: string
          status?: string
          valor_total: number
        }
        Update: {
          atendente_nome?: string | null
          atualizado_em?: string
          canal?: string
          consumo_aplicado?: boolean
          criado_em?: string
          frete_status?: string
          id?: string
          idempotency_key?: string | null
          itens?: Json
          numero_pedido?: string
          status?: string
          valor_total?: number
        }
        Relationships: []
      }
      produto_movimentacoes: {
        Row: {
          criado_em: string
          id: string
          observacao: string | null
          origem: string | null
          pedido_id: string | null
          por_usuario: string | null
          produto_id: string
          quantidade: number
          tamanho: string
          tipo: string
        }
        Insert: {
          criado_em?: string
          id?: string
          observacao?: string | null
          origem?: string | null
          pedido_id?: string | null
          por_usuario?: string | null
          produto_id: string
          quantidade: number
          tamanho: string
          tipo: string
        }
        Update: {
          criado_em?: string
          id?: string
          observacao?: string | null
          origem?: string | null
          pedido_id?: string | null
          por_usuario?: string | null
          produto_id?: string
          quantidade?: number
          tamanho?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_movimentacoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_variacoes: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          produto_id: string
          quantidade: number
          tamanho: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          produto_id: string
          quantidade?: number
          tamanho: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          produto_id?: string
          quantidade?: number
          tamanho?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_variacoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          arquivado_em: string | null
          ativo: boolean
          atualizado_em: string
          categoria: string
          colecao: string | null
          cor: string | null
          criado_em: string
          descricao: string | null
          destaque: boolean
          id: string
          imagens: Json
          marca: string
          nome: string
          preco: number
          sku: string
          slug: string
        }
        Insert: {
          arquivado_em?: string | null
          ativo?: boolean
          atualizado_em?: string
          categoria: string
          colecao?: string | null
          cor?: string | null
          criado_em?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          imagens?: Json
          marca: string
          nome: string
          preco: number
          sku: string
          slug: string
        }
        Update: {
          arquivado_em?: string | null
          ativo?: boolean
          atualizado_em?: string
          categoria?: string
          colecao?: string | null
          cor?: string | null
          criado_em?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          imagens?: Json
          marca?: string
          nome?: string
          preco?: number
          sku?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          atualizado_em: string
          criado_em: string
          nome: string
          status: string
          telefone: string
          ultimo_acesso: string | null
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          nome?: string
          status?: string
          telefone?: string
          ultimo_acesso?: string | null
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          nome?: string
          status?: string
          telefone?: string
          ultimo_acesso?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ajustar_estoque: {
        Args: {
          p_observacao?: string
          p_pedido_id?: string
          p_produto_id: string
          p_qty: number
          p_tamanho: string
          p_tipo: string
        }
        Returns: number
      }
      criar_pedido: {
        Args: {
          p_canal?: string
          p_cliente: Json
          p_entrega: Json
          p_idempotency_key?: string
          p_itens: Json
          p_observacoes?: string
          p_pagamento: Json
        }
        Returns: {
          id: string
          numero_pedido: string
          valor_total: number
        }[]
      }
      gerar_numero_pedido: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      transicionar_pedido: {
        Args: {
          p_novo_status: string
          p_pedido_id: string
          p_responsavel?: string
        }
        Returns: {
          atendente_nome: string | null
          atualizado_em: string
          canal: string
          consumo_aplicado: boolean
          criado_em: string
          frete_status: string
          id: string
          idempotency_key: string | null
          itens: Json
          numero_pedido: string
          status: string
          valor_total: number
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "atendente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "atendente"],
    },
  },
} as const
