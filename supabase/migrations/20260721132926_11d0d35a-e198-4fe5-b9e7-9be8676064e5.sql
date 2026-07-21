
-- ─────────────────────────────────────────────────────────────────────────
-- 1. HISTÓRICO DE STATUS DE PEDIDOS
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE public.pedido_status_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  de text,
  para text NOT NULL,
  por_usuario uuid REFERENCES auth.users(id),
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pedido_status_historico TO authenticated;
GRANT ALL ON public.pedido_status_historico TO service_role;

ALTER TABLE public.pedido_status_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view status history"
  ON public.pedido_status_historico FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'atendente'));

CREATE INDEX idx_pedido_status_historico_pedido
  ON public.pedido_status_historico (pedido_id, criado_em);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. TABELA DE TRANSIÇÕES PERMITIDAS (espelha máquina de estados)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE public.pedido_transicoes (
  de text NOT NULL,
  para text NOT NULL,
  PRIMARY KEY (de, para)
);

GRANT SELECT ON public.pedido_transicoes TO authenticated;
GRANT ALL ON public.pedido_transicoes TO service_role;

ALTER TABLE public.pedido_transicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read transitions"
  ON public.pedido_transicoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'atendente'));

INSERT INTO public.pedido_transicoes(de,para) VALUES
  ('novo','pagamento_confirmado'),('novo','separado'),('novo','reservado'),('novo','cancelado'),
  ('pagamento_confirmado','separado'),('pagamento_confirmado','reservado'),('pagamento_confirmado','cancelado'),
  ('separado','reservado'),('separado','aguardando_retirada'),('separado','enviado'),('separado','finalizado'),('separado','cancelado'),
  ('reservado','separado'),('reservado','aguardando_retirada'),('reservado','enviado'),('reservado','finalizado'),('reservado','cancelado'),
  ('aguardando_retirada','finalizado'),('aguardando_retirada','cancelado'),
  ('enviado','finalizado'),('enviado','cancelado');

-- ─────────────────────────────────────────────────────────────────────────
-- 3. GUARD DE UPDATE EM PEDIDOS
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pedidos_guard_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.itens IS DISTINCT FROM OLD.itens THEN
    RAISE EXCEPTION 'Itens do pedido são imutáveis após criação.';
  END IF;
  IF NEW.valor_total IS DISTINCT FROM OLD.valor_total THEN
    RAISE EXCEPTION 'Valor total do pedido é imutável após criação.';
  END IF;
  IF NEW.numero_pedido IS DISTINCT FROM OLD.numero_pedido THEN
    RAISE EXCEPTION 'Número do pedido é imutável.';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pedido_transicoes
      WHERE de = OLD.status AND para = NEW.status
    ) THEN
      RAISE EXCEPTION 'Transição de status inválida: % → %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER pedidos_guard_update
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.pedidos_guard_update();

-- Log AFTER UPDATE de mudança de status
CREATE OR REPLACE FUNCTION public.pedidos_log_status_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.pedido_status_historico (pedido_id, de, para, por_usuario)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER pedidos_log_status_update
  AFTER UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.pedidos_log_status_update();

-- Log AFTER INSERT do estado inicial
CREATE OR REPLACE FUNCTION public.pedidos_log_status_create()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.pedido_status_historico (pedido_id, de, para, observacao)
  VALUES (NEW.id, NULL, NEW.status, 'Pedido criado');
  RETURN NEW;
END $$;

CREATE TRIGGER pedidos_log_status_create
  AFTER INSERT ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.pedidos_log_status_create();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. CRIAR PEDIDO — recálculo do total no servidor
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.criar_pedido(
  p_itens jsonb,
  p_cliente jsonb,
  p_entrega jsonb,
  p_pagamento jsonb,
  p_observacoes text DEFAULT NULL,
  p_canal text DEFAULT 'whatsapp'
) RETURNS TABLE(id uuid, numero_pedido text, valor_total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_numero text;
  v_subtotal numeric := 0;
  v_frete numeric := 0;
  v_total numeric;
  v_item jsonb;
  v_slug text;
  v_qty int;
  v_preco numeric;
  v_itens_normalizados jsonb := '[]'::jsonb;
BEGIN
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Pedido sem itens.';
  END IF;
  IF p_cliente IS NULL OR COALESCE(p_cliente->>'nome','') = '' OR COALESCE(p_cliente->>'telefone','') = '' THEN
    RAISE EXCEPTION 'Dados do cliente obrigatórios.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_slug := v_item->>'slug';
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    IF v_slug IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Item inválido no pedido.';
    END IF;
    SELECT preco INTO v_preco
      FROM public.produtos
     WHERE slug = v_slug AND ativo = TRUE AND arquivado_em IS NULL;
    IF v_preco IS NULL THEN
      RAISE EXCEPTION 'Produto indisponível: %', v_slug;
    END IF;
    v_subtotal := v_subtotal + (v_preco * v_qty);
    v_itens_normalizados := v_itens_normalizados || jsonb_build_array(
      jsonb_build_object(
        'slug', v_slug,
        'name', COALESCE(v_item->>'name',''),
        'size', COALESCE(v_item->>'size',''),
        'quantity', v_qty,
        'price', v_preco,
        'image', v_item->>'image'
      )
    );
  END LOOP;

  IF p_entrega IS NOT NULL AND (p_entrega->'frete'->>'cost') ~ '^[0-9]+(\.[0-9]+)?$' THEN
    v_frete := (p_entrega->'frete'->>'cost')::numeric;
  END IF;

  v_total := v_subtotal + v_frete;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Valor total inválido.';
  END IF;

  INSERT INTO public.pedidos (itens, valor_total, status, canal)
  VALUES (
    jsonb_build_object(
      'produtos', v_itens_normalizados,
      'cliente', p_cliente,
      'entrega', p_entrega,
      'pagamento', p_pagamento,
      'observacoes', p_observacoes,
      'subtotal', v_subtotal,
      'frete', v_frete
    ),
    v_total,
    'novo',
    COALESCE(p_canal, 'whatsapp')
  )
  RETURNING pedidos.id, pedidos.numero_pedido INTO v_id, v_numero;

  RETURN QUERY SELECT v_id, v_numero, v_total;
END $$;

REVOKE ALL ON FUNCTION public.criar_pedido(jsonb,jsonb,jsonb,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_pedido(jsonb,jsonb,jsonb,jsonb,text,text) TO anon, authenticated;

-- Bloqueia INSERT direto de anon (agora apenas via RPC)
REVOKE INSERT ON public.pedidos FROM anon;
DROP POLICY IF EXISTS "Anon can insert new orders" ON public.pedidos;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. AJUSTAR ESTOQUE — atômico
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ajustar_estoque(
  p_produto_id uuid,
  p_tamanho text,
  p_tipo text,
  p_qty int,
  p_observacao text DEFAULT NULL,
  p_pedido_id uuid DEFAULT NULL
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current int;
  v_new int;
  v_delta int;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'atendente')) THEN
    RAISE EXCEPTION 'Sem permissão para ajustar estoque.';
  END IF;
  IF p_tipo NOT IN ('entrada','saida','ajuste','reposicao','consumo_pedido') THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido: %', p_tipo;
  END IF;
  IF p_qty < 0 THEN
    RAISE EXCEPTION 'Quantidade não pode ser negativa.';
  END IF;

  SELECT quantidade INTO v_current
    FROM public.produto_variacoes
   WHERE produto_id = p_produto_id AND tamanho = p_tamanho
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.produto_variacoes (produto_id, tamanho, quantidade)
    VALUES (p_produto_id, p_tamanho, 0)
    RETURNING quantidade INTO v_current;
  END IF;

  v_new := CASE p_tipo
    WHEN 'ajuste' THEN p_qty
    WHEN 'entrada' THEN v_current + p_qty
    WHEN 'reposicao' THEN v_current + p_qty
    WHEN 'saida' THEN v_current - p_qty
    WHEN 'consumo_pedido' THEN v_current - p_qty
  END;

  IF v_new < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente (atual %, solicitado %).', v_current, p_qty;
  END IF;

  v_delta := v_new - v_current;

  UPDATE public.produto_variacoes
     SET quantidade = v_new
   WHERE produto_id = p_produto_id AND tamanho = p_tamanho;

  IF v_delta <> 0 THEN
    INSERT INTO public.produto_movimentacoes
      (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id)
    VALUES
      (p_produto_id, p_tamanho, p_tipo, v_delta, v_uid, p_observacao, p_pedido_id);
  END IF;

  RETURN v_new;
END $$;

REVOKE ALL ON FUNCTION public.ajustar_estoque(uuid,text,text,int,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ajustar_estoque(uuid,text,text,int,text,uuid) TO authenticated;

-- Bloqueia UPDATE direto de quantidade para staff — só pela função.
-- Mantém INSERT/DELETE (gestão de variações) e UPDATE de outras colunas.
REVOKE UPDATE ON public.produto_variacoes FROM authenticated;
GRANT UPDATE (tamanho, atualizado_em) ON public.produto_variacoes TO authenticated;
