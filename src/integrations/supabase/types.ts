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
      checkout_bloqueios: {
        Row: {
          criado_em: string
          detalhe: Json
          id: string
          motivo: string
          telefone_hash: string
          telefone_mascarado: string
        }
        Insert: {
          criado_em?: string
          detalhe?: Json
          id?: string
          motivo: string
          telefone_hash: string
          telefone_mascarado: string
        }
        Update: {
          criado_em?: string
          detalhe?: Json
          id?: string
          motivo?: string
          telefone_hash?: string
          telefone_mascarado?: string
        }
        Relationships: []
      }
      financeiro_lancamentos: {
        Row: {
          competencia: string
          criado_em: string
          detalhe: Json
          id: string
          metodo: string | null
          numero_pedido: string
          origem: string
          pedido_id: string
          por_usuario: string | null
          referencia_id: string | null
          tipo: string
          valor: number
        }
        Insert: {
          competencia?: string
          criado_em?: string
          detalhe?: Json
          id?: string
          metodo?: string | null
          numero_pedido: string
          origem: string
          pedido_id: string
          por_usuario?: string | null
          referencia_id?: string | null
          tipo: string
          valor: number
        }
        Update: {
          competencia?: string
          criado_em?: string
          detalhe?: Json
          id?: string
          metodo?: string | null
          numero_pedido?: string
          origem?: string
          pedido_id?: string
          por_usuario?: string | null
          referencia_id?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      job_execucoes: {
        Row: {
          criado_em: string
          id: string
          job: string
          resultado: Json
        }
        Insert: {
          criado_em?: string
          id?: string
          job: string
          resultado?: Json
        }
        Update: {
          criado_em?: string
          id?: string
          job?: string
          resultado?: Json
        }
        Relationships: []
      }
      notificacao_leituras: {
        Row: {
          lido_em: string
          notificacao_id: string
          user_id: string
        }
        Insert: {
          lido_em?: string
          notificacao_id: string
          user_id: string
        }
        Update: {
          lido_em?: string
          notificacao_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacao_leituras_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "notificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          criado_em: string
          dedupe_key: string
          detalhe: Json
          entidade: string | null
          entidade_id: string | null
          id: string
          mensagem: string
          severidade: string
          tipo: string
          titulo: string
        }
        Insert: {
          criado_em?: string
          dedupe_key: string
          detalhe?: Json
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          mensagem: string
          severidade?: string
          tipo: string
          titulo: string
        }
        Update: {
          criado_em?: string
          dedupe_key?: string
          detalhe?: Json
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          mensagem?: string
          severidade?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      pagamento_transicoes: {
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
      parametros_operacionais: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          descricao: string | null
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          descricao?: string | null
          valor: Json
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          descricao?: string | null
          valor?: Json
        }
        Relationships: []
      }
      pedido_atendimentos: {
        Row: {
          acao: string
          criado_em: string
          id: string
          observacao: string | null
          pedido_id: string
          por_usuario: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
        }
        Insert: {
          acao: string
          criado_em?: string
          id?: string
          observacao?: string | null
          pedido_id: string
          por_usuario?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
        }
        Update: {
          acao?: string
          criado_em?: string
          id?: string
          observacao?: string | null
          pedido_id?: string
          por_usuario?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_atendimentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_devolucao_itens: {
        Row: {
          condicao: string
          criado_em: string
          devolucao_id: string
          id: string
          produto_id: string | null
          quantidade: number
          retornou_estoque: boolean
          slug: string
          tamanho: string
        }
        Insert: {
          condicao: string
          criado_em?: string
          devolucao_id: string
          id?: string
          produto_id?: string | null
          quantidade: number
          retornou_estoque?: boolean
          slug: string
          tamanho: string
        }
        Update: {
          condicao?: string
          criado_em?: string
          devolucao_id?: string
          id?: string
          produto_id?: string | null
          quantidade?: number
          retornou_estoque?: boolean
          slug?: string
          tamanho?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_devolucao_itens_devolucao_id_fkey"
            columns: ["devolucao_id"]
            isOneToOne: false
            referencedRelation: "pedido_devolucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_devolucao_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_devolucoes: {
        Row: {
          aprovado_por: string | null
          criado_em: string
          evidencias: Json
          id: string
          motivo: string
          observacoes: string | null
          pedido_id: string
          valor_estornado: number
        }
        Insert: {
          aprovado_por?: string | null
          criado_em?: string
          evidencias?: Json
          id?: string
          motivo: string
          observacoes?: string | null
          pedido_id: string
          valor_estornado?: number
        }
        Update: {
          aprovado_por?: string | null
          criado_em?: string
          evidencias?: Json
          id?: string
          motivo?: string
          observacoes?: string | null
          pedido_id?: string
          valor_estornado?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_devolucoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_eventos: {
        Row: {
          criado_em: string
          detalhe: Json
          id: string
          numero_pedido: string
          origem: string
          pedido_id: string
          por_usuario: string | null
          tipo: string
        }
        Insert: {
          criado_em?: string
          detalhe?: Json
          id?: string
          numero_pedido: string
          origem: string
          pedido_id: string
          por_usuario?: string | null
          tipo: string
        }
        Update: {
          criado_em?: string
          detalhe?: Json
          id?: string
          numero_pedido?: string
          origem?: string
          pedido_id?: string
          por_usuario?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_eventos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_pagamentos: {
        Row: {
          comprovante_url: string | null
          criado_em: string
          estado: string
          id: string
          metodo: string | null
          observacao: string | null
          parcelas: number
          pedido_id: string
          por_usuario: string | null
          valor: number
        }
        Insert: {
          comprovante_url?: string | null
          criado_em?: string
          estado: string
          id?: string
          metodo?: string | null
          observacao?: string | null
          parcelas?: number
          pedido_id: string
          por_usuario?: string | null
          valor?: number
        }
        Update: {
          comprovante_url?: string | null
          criado_em?: string
          estado?: string
          id?: string
          metodo?: string | null
          observacao?: string | null
          parcelas?: number
          pedido_id?: string
          por_usuario?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_pagamentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
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
          atribuido_em: string | null
          atualizado_em: string
          canal: string
          consumo_aplicado: boolean
          criado_em: string
          frete_status: string
          id: string
          idempotency_key: string | null
          itens: Json
          numero_pedido: string
          pagamento_estado: string
          responsavel_id: string | null
          status: string
          valor_devolvido: number
          valor_total: number
          whatsapp_confirmacao_origem: string | null
          whatsapp_declarado_enviado_em: string | null
        }
        Insert: {
          atendente_nome?: string | null
          atribuido_em?: string | null
          atualizado_em?: string
          canal?: string
          consumo_aplicado?: boolean
          criado_em?: string
          frete_status?: string
          id?: string
          idempotency_key?: string | null
          itens: Json
          numero_pedido?: string
          pagamento_estado?: string
          responsavel_id?: string | null
          status?: string
          valor_devolvido?: number
          valor_total: number
          whatsapp_confirmacao_origem?: string | null
          whatsapp_declarado_enviado_em?: string | null
        }
        Update: {
          atendente_nome?: string | null
          atribuido_em?: string | null
          atualizado_em?: string
          canal?: string
          consumo_aplicado?: boolean
          criado_em?: string
          frete_status?: string
          id?: string
          idempotency_key?: string | null
          itens?: Json
          numero_pedido?: string
          pagamento_estado?: string
          responsavel_id?: string | null
          status?: string
          valor_devolvido?: number
          valor_total?: number
          whatsapp_confirmacao_origem?: string | null
          whatsapp_declarado_enviado_em?: string | null
        }
        Relationships: []
      }
      produto_kit_itens: {
        Row: {
          atualizado_em: string
          componente_id: string
          componente_tamanho: string
          criado_em: string
          id: string
          kit_id: string
          kit_tamanho: string
          quantidade: number
        }
        Insert: {
          atualizado_em?: string
          componente_id: string
          componente_tamanho: string
          criado_em?: string
          id?: string
          kit_id: string
          kit_tamanho: string
          quantidade?: number
        }
        Update: {
          atualizado_em?: string
          componente_id?: string
          componente_tamanho?: string
          criado_em?: string
          id?: string
          kit_id?: string
          kit_tamanho?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "produto_kit_itens_componente_id_fkey"
            columns: ["componente_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_kit_itens_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_movimentacoes: {
        Row: {
          criado_em: string
          id: string
          motivo: string | null
          observacao: string | null
          origem: string | null
          pedido_id: string | null
          por_usuario: string | null
          produto_id: string
          quantidade: number
          saldo_anterior: number | null
          saldo_posterior: number | null
          tamanho: string
          tipo: string
        }
        Insert: {
          criado_em?: string
          id?: string
          motivo?: string | null
          observacao?: string | null
          origem?: string | null
          pedido_id?: string | null
          por_usuario?: string | null
          produto_id: string
          quantidade: number
          saldo_anterior?: number | null
          saldo_posterior?: number | null
          tamanho: string
          tipo: string
        }
        Update: {
          criado_em?: string
          id?: string
          motivo?: string | null
          observacao?: string | null
          origem?: string | null
          pedido_id?: string | null
          por_usuario?: string | null
          produto_id?: string
          quantidade?: number
          saldo_anterior?: number | null
          saldo_posterior?: number | null
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
          disponivel: number | null
          id: string
          origem_tamanho: string
          origem_tamanho_confirmado_em: string | null
          origem_tamanho_confirmado_por: string | null
          origem_tamanho_evidencia: string | null
          produto_id: string
          quantidade: number
          quantidade_quarentena: number
          quantidade_reservada: number
          tamanho: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          disponivel?: number | null
          id?: string
          origem_tamanho?: string
          origem_tamanho_confirmado_em?: string | null
          origem_tamanho_confirmado_por?: string | null
          origem_tamanho_evidencia?: string | null
          produto_id: string
          quantidade?: number
          quantidade_quarentena?: number
          quantidade_reservada?: number
          tamanho: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          disponivel?: number | null
          id?: string
          origem_tamanho?: string
          origem_tamanho_confirmado_em?: string | null
          origem_tamanho_confirmado_por?: string | null
          origem_tamanho_evidencia?: string | null
          produto_id?: string
          quantidade?: number
          quantidade_quarentena?: number
          quantidade_reservada?: number
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
          modelo_estoque: string
          nome: string
          observacoes_internas: string | null
          parcelamento: string | null
          preco: number
          preco_cartao: number | null
          preco_status: string
          quantidade_conferida: boolean
          sku: string
          slug: string
          status_publicacao: string
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
          modelo_estoque?: string
          nome: string
          observacoes_internas?: string | null
          parcelamento?: string | null
          preco: number
          preco_cartao?: number | null
          preco_status?: string
          quantidade_conferida?: boolean
          sku: string
          slug: string
          status_publicacao?: string
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
          modelo_estoque?: string
          nome?: string
          observacoes_internas?: string | null
          parcelamento?: string | null
          preco?: number
          preco_cartao?: number | null
          preco_status?: string
          quantidade_conferida?: boolean
          sku?: string
          slug?: string
          status_publicacao?: string
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
      regras_preco_aplicacoes: {
        Row: {
          afetados: number
          categoria: string
          criado_em: string
          detalhe: Json
          id: string
          incluiu_confirmados: boolean
          parcelamento: string | null
          por_usuario: string | null
          preco: number
          preco_cartao: number | null
        }
        Insert: {
          afetados: number
          categoria: string
          criado_em?: string
          detalhe?: Json
          id?: string
          incluiu_confirmados?: boolean
          parcelamento?: string | null
          por_usuario?: string | null
          preco: number
          preco_cartao?: number | null
        }
        Update: {
          afetados?: number
          categoria?: string
          criado_em?: string
          detalhe?: Json
          id?: string
          incluiu_confirmados?: boolean
          parcelamento?: string | null
          por_usuario?: string | null
          preco?: number
          preco_cartao?: number | null
        }
        Relationships: []
      }
      regras_preco_categoria: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          categoria: string
          criado_em: string
          parcelamento: string | null
          preco: number
          preco_cartao: number | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          categoria: string
          criado_em?: string
          parcelamento?: string | null
          preco: number
          preco_cartao?: number | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          categoria?: string
          criado_em?: string
          parcelamento?: string | null
          preco?: number
          preco_cartao?: number | null
        }
        Relationships: []
      }
      reservas_estoque: {
        Row: {
          atualizado_em: string
          criado_em: string
          estado: string
          expira_em: string
          id: string
          pedido_id: string
          produto_id: string
          quantidade: number
          tamanho: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          estado?: string
          expira_em: string
          id?: string
          pedido_id: string
          produto_id: string
          quantidade: number
          tamanho: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          estado?: string
          expira_em?: string
          id?: string
          pedido_id?: string
          produto_id?: string
          quantidade?: number
          tamanho?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_estoque_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
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
      catalogo_preview: {
        Row: {
          categoria: string | null
          colecao: string | null
          compravel: boolean | null
          cor: string | null
          criado_em: string | null
          descricao: string | null
          destaque: boolean | null
          imagens: Json | null
          marca: string | null
          modelo_estoque: string | null
          nome: string | null
          parcelamento: string | null
          preco: number | null
          preco_cartao: number | null
          slug: string | null
          variacoes: Json | null
        }
        Insert: {
          categoria?: string | null
          colecao?: string | null
          compravel?: never
          cor?: string | null
          criado_em?: string | null
          descricao?: string | null
          destaque?: boolean | null
          imagens?: Json | null
          marca?: string | null
          modelo_estoque?: string | null
          nome?: string | null
          parcelamento?: never
          preco?: never
          preco_cartao?: never
          slug?: string | null
          variacoes?: never
        }
        Update: {
          categoria?: string | null
          colecao?: string | null
          compravel?: never
          cor?: string | null
          criado_em?: string | null
          descricao?: string | null
          destaque?: boolean | null
          imagens?: Json | null
          marca?: string | null
          modelo_estoque?: string | null
          nome?: string | null
          parcelamento?: never
          preco?: never
          preco_cartao?: never
          slug?: string | null
          variacoes?: never
        }
        Relationships: []
      }
      catalogo_publico: {
        Row: {
          categoria: string | null
          colecao: string | null
          compravel: boolean | null
          cor: string | null
          criado_em: string | null
          descricao: string | null
          destaque: boolean | null
          imagens: Json | null
          marca: string | null
          modelo_estoque: string | null
          nome: string | null
          parcelamento: string | null
          preco: number | null
          preco_cartao: number | null
          preco_confirmado: boolean | null
          slug: string | null
          variacoes: Json | null
        }
        Insert: {
          categoria?: string | null
          colecao?: string | null
          compravel?: never
          cor?: string | null
          criado_em?: string | null
          descricao?: string | null
          destaque?: boolean | null
          imagens?: Json | null
          marca?: string | null
          modelo_estoque?: string | null
          nome?: string | null
          parcelamento?: never
          preco?: never
          preco_cartao?: never
          preco_confirmado?: never
          slug?: string | null
          variacoes?: never
        }
        Update: {
          categoria?: string | null
          colecao?: string | null
          compravel?: never
          cor?: string | null
          criado_em?: string | null
          descricao?: string | null
          destaque?: boolean | null
          imagens?: Json | null
          marca?: string | null
          modelo_estoque?: string | null
          nome?: string | null
          parcelamento?: never
          preco?: never
          preco_cartao?: never
          preco_confirmado?: never
          slug?: string | null
          variacoes?: never
        }
        Relationships: []
      }
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
      aplicar_regra_preco: {
        Args: {
          p_categoria: string
          p_incluir_confirmados?: boolean
          p_parcelamento?: string
          p_preco: number
          p_preco_cartao?: number
        }
        Returns: Json
      }
      assumir_atendimento: {
        Args: { p_pedido_id: string }
        Returns: {
          atendente_nome: string | null
          atribuido_em: string | null
          atualizado_em: string
          canal: string
          consumo_aplicado: boolean
          criado_em: string
          frete_status: string
          id: string
          idempotency_key: string | null
          itens: Json
          numero_pedido: string
          pagamento_estado: string
          responsavel_id: string | null
          status: string
          valor_devolvido: number
          valor_total: number
          whatsapp_confirmacao_origem: string | null
          whatsapp_declarado_enviado_em: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      avaliar_publicacao: { Args: { p_produto_id: string }; Returns: Json }
      cancelar_pedido_checkout: {
        Args: { p_idempotency_key: string; p_pedido_id: string }
        Returns: {
          id: string
          numero_pedido: string
          status: string
          valor_total: number
        }[]
      }
      checkout_guard_antiabuso: {
        Args: { p_telefone: string }
        Returns: undefined
      }
      confirmar_whatsapp_checkout: {
        Args: { p_idempotency_key: string; p_pedido_id: string }
        Returns: {
          id: string
          numero_pedido: string
          snapshot: Json
          status: string
          whatsapp_declarado_enviado_em: string
        }[]
      }
      converter_reservas_pedido: {
        Args: { p_pedido_id: string }
        Returns: undefined
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
          frete_status: string
          id: string
          numero_pedido: string
          snapshot: Json
          valor_total: number
        }[]
      }
      definir_frete_pedido: {
        Args: { p_pedido_id: string; p_valor: number }
        Returns: {
          atendente_nome: string | null
          atribuido_em: string | null
          atualizado_em: string
          canal: string
          consumo_aplicado: boolean
          criado_em: string
          frete_status: string
          id: string
          idempotency_key: string | null
          itens: Json
          numero_pedido: string
          pagamento_estado: string
          responsavel_id: string | null
          status: string
          valor_devolvido: number
          valor_total: number
          whatsapp_confirmacao_origem: string | null
          whatsapp_declarado_enviado_em: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      definir_parametro: {
        Args: { p_chave: string; p_valor: Json }
        Returns: undefined
      }
      devolver_para_fila: {
        Args: { p_observacao?: string; p_pedido_id: string }
        Returns: {
          atendente_nome: string | null
          atribuido_em: string | null
          atualizado_em: string
          canal: string
          consumo_aplicado: boolean
          criado_em: string
          frete_status: string
          id: string
          idempotency_key: string | null
          itens: Json
          numero_pedido: string
          pagamento_estado: string
          responsavel_id: string | null
          status: string
          valor_devolvido: number
          valor_total: number
          whatsapp_confirmacao_origem: string | null
          whatsapp_declarado_enviado_em: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      diagnostico_catalogo: {
        Args: never
        Returns: {
          arquivado: boolean
          ativo: boolean
          blocking_reasons: string[]
          can_publish: boolean
          categoria: string
          disponivel: number
          foto_principal: string
          fotos: number
          id: string
          marca: string
          missing_fields: string[]
          modelo_estoque: string
          nome: string
          preco: number
          preco_cartao: number
          preco_status: string
          quantidade: number
          quantidade_conferida: boolean
          quarentena: number
          reservada: number
          situacao: string
          sku: string
          status_publicacao: string
          tamanhos: Json
        }[]
      }
      emitir_notificacao: {
        Args: {
          p_dedupe_key: string
          p_detalhe?: Json
          p_entidade?: string
          p_entidade_id?: string
          p_mensagem: string
          p_severidade?: string
          p_tipo: string
          p_titulo: string
        }
        Returns: undefined
      }
      expirar_reservas: { Args: never; Returns: number }
      expirar_reservas_variacao: {
        Args: { p_produto_id: string; p_tamanho: string }
        Returns: number
      }
      explodir_item_pedido: {
        Args: { p_qty: number; p_size: string; p_slug: string }
        Returns: {
          produto_id: string
          quantidade: number
          tamanho: string
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
      job_expirar_reservas: { Args: never; Returns: number }
      kit_disponivel: {
        Args: { p_kit_id: string; p_tamanho: string }
        Returns: number
      }
      lancar_financeiro: {
        Args: {
          p_detalhe?: Json
          p_origem: string
          p_pedido: Database["public"]["Tables"]["pedidos"]["Row"]
          p_referencia: string
          p_tipo: string
          p_valor: number
        }
        Returns: undefined
      }
      liberar_reservas_pedido: {
        Args: { p_motivo: string; p_pedido_id: string }
        Returns: undefined
      }
      listar_equipe: {
        Args: never
        Returns: {
          criado_em: string
          email: string
          nome: string
          perfil_status: string
          roles: string[]
          situacao: string
          telefone: string
          ultimo_acesso: string
          user_id: string
        }[]
      }
      metricas_financeiras: { Args: { p_periodo?: string }; Returns: Json }
      parametro_int: {
        Args: { p_chave: string; p_default: number }
        Returns: number
      }
      pedido_snapshot: {
        Args: { p_pedido: Database["public"]["Tables"]["pedidos"]["Row"] }
        Returns: Json
      }
      previsualizar_regra_preco: {
        Args: { p_categoria: string; p_incluir_confirmados?: boolean }
        Returns: Json
      }
      produto_publicavel: {
        Args: { p: Database["public"]["Tables"]["produtos"]["Row"] }
        Returns: boolean
      }
      qualidade_catalogo: { Args: never; Returns: Json }
      registrar_devolucao: {
        Args: {
          p_evidencias?: Json
          p_itens: Json
          p_motivo: string
          p_observacoes?: string
          p_pedido_id: string
          p_valor_estornado?: number
        }
        Returns: string
      }
      registrar_pagamento: {
        Args: {
          p_comprovante_url?: string
          p_estado: string
          p_observacao?: string
          p_pedido_id: string
        }
        Returns: {
          atendente_nome: string | null
          atribuido_em: string | null
          atualizado_em: string
          canal: string
          consumo_aplicado: boolean
          criado_em: string
          frete_status: string
          id: string
          idempotency_key: string | null
          itens: Json
          numero_pedido: string
          pagamento_estado: string
          responsavel_id: string | null
          status: string
          valor_devolvido: number
          valor_total: number
          whatsapp_confirmacao_origem: string | null
          whatsapp_declarado_enviado_em: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserva_minutos: { Args: never; Returns: number }
      status_job_reservas: { Args: never; Returns: Json }
      transferir_atendimento: {
        Args: {
          p_novo_responsavel: string
          p_observacao?: string
          p_pedido_id: string
        }
        Returns: {
          atendente_nome: string | null
          atribuido_em: string | null
          atualizado_em: string
          canal: string
          consumo_aplicado: boolean
          criado_em: string
          frete_status: string
          id: string
          idempotency_key: string | null
          itens: Json
          numero_pedido: string
          pagamento_estado: string
          responsavel_id: string | null
          status: string
          valor_devolvido: number
          valor_total: number
          whatsapp_confirmacao_origem: string | null
          whatsapp_declarado_enviado_em: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transicionar_pedido: {
        Args: { p_novo_status: string; p_pedido_id: string }
        Returns: {
          atendente_nome: string | null
          atribuido_em: string | null
          atualizado_em: string
          canal: string
          consumo_aplicado: boolean
          criado_em: string
          frete_status: string
          id: string
          idempotency_key: string | null
          itens: Json
          numero_pedido: string
          pagamento_estado: string
          responsavel_id: string | null
          status: string
          valor_devolvido: number
          valor_total: number
          whatsapp_confirmacao_origem: string | null
          whatsapp_declarado_enviado_em: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validar_checkout_key: { Args: { p_key: string }; Returns: undefined }
      variacao_publicavel: {
        Args: { v: Database["public"]["Tables"]["produto_variacoes"]["Row"] }
        Returns: boolean
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
