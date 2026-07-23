-- Sprint 4 · Onda 1 — Integridade transacional de pedidos e estoque.
-- Adiciona idempotência na criação, marca de consumo aplicado e RPC única
-- que executa transição de status + consumo/estorno de estoque atomicamente.

-- 1) Colunas novas em pedidos --------------------------------------------------
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS frete_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS consumo_aplicado boolean NOT NULL DEFAULT false;

-- Constraints (idempotentes)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_frete_status_check') THEN
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_frete_status_check
      CHECK (frete_status IN ('pendente','definido'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_idempotency_key_uidx
  ON public.pedidos (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Índice defensivo: nunca dois consumos de pedido para a mesma variação.
CREATE UNIQUE INDEX IF NOT EXISTS produto_movimentacoes_consumo_uidx
  ON public.produto_movimentacoes (pedido_id, produto_id, tamanho)
  WHERE tipo = 'consumo_pedido' AND pedido_id IS NOT NULL;

-- 2) criar_pedido — idempotente e sem preço vindo do cliente -------------------
CREATE OR REPLACE FUNCTION public.criar_pedido(
  p_itens jsonb,
  p_cliente jsonb,
  p_entrega jsonb,
  p_pagamento jsonb,
  p_observacoes text DEFAULT NULL,
  p_canal text DEFAULT 'whatsapp',
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE(id uuid, numero_pedido text, valor_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_numero text;
  v_subtotal numeric := 0;
  v_total numeric;
  v_item jsonb;
  v_slug text;
  v_qty int;
  v_preco numeric;
  v_size text;
  v_variacao_qty int;
  v_itens_normalizados jsonb := '[]'::jsonb;
  v_existente record;
  v_metodo_entrega text;
BEGIN
  -- Idempotência: mesma chave devolve o pedido existente.
  IF p_idempotency_key IS NOT NULL AND length(p_idempotency_key) > 0 THEN
    SELECT p.id, p.numero_pedido, p.valor_total INTO v_existente
      FROM public.pedidos p
     WHERE p.idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN QUERY SELECT v_existente.id, v_existente.numero_pedido, v_existente.valor_total;
      RETURN;
    END IF;
  END IF;

  -- Validações obrigatórias
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Pedido sem itens.';
  END IF;
  IF jsonb_array_length(p_itens) > 50 THEN
    RAISE EXCEPTION 'Pedido excede limite de 50 itens.';
  END IF;
  IF p_cliente IS NULL
     OR COALESCE(p_cliente->>'nome','') = ''
     OR COALESCE(p_cliente->>'telefone','') = '' THEN
    RAISE EXCEPTION 'Dados do cliente obrigatórios.';
  END IF;
  IF length(COALESCE(p_cliente->>'nome','')) > 120
     OR length(COALESCE(p_cliente->>'telefone','')) > 32 THEN
    RAISE EXCEPTION 'Nome/telefone excedem tamanho permitido.';
  END IF;

  v_metodo_entrega := COALESCE(p_entrega->>'metodo','');
  IF v_metodo_entrega NOT IN ('entrega','retirada') THEN
    RAISE EXCEPTION 'Método de entrega inválido.';
  END IF;

  -- Itens: valida catálogo (produto ativo), tamanho existente, saldo,
  -- normaliza payload e recalcula subtotal com preço do banco.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_slug := v_item->>'slug';
    v_size := COALESCE(v_item->>'size', '');
    v_qty  := COALESCE((v_item->>'quantity')::int, 0);
    IF v_slug IS NULL OR v_qty <= 0 OR v_qty > 99 THEN
      RAISE EXCEPTION 'Item inválido no pedido.';
    END IF;
    IF v_size = '' THEN
      RAISE EXCEPTION 'Tamanho ausente para %.', v_slug;
    END IF;

    SELECT preco INTO v_preco
      FROM public.produtos
     WHERE slug = v_slug AND ativo = TRUE AND arquivado_em IS NULL;
    IF v_preco IS NULL THEN
      RAISE EXCEPTION 'Produto indisponível: %', v_slug;
    END IF;

    SELECT quantidade INTO v_variacao_qty
      FROM public.produto_variacoes pv
      JOIN public.produtos pr ON pr.id = pv.produto_id
     WHERE pr.slug = v_slug AND pv.tamanho = v_size;
    IF v_variacao_qty IS NULL THEN
      RAISE EXCEPTION 'Tamanho % indisponível para %.', v_size, v_slug;
    END IF;
    IF v_variacao_qty < v_qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para % tam %.', v_slug, v_size;
    END IF;

    v_subtotal := v_subtotal + (v_preco * v_qty);
    v_itens_normalizados := v_itens_normalizados || jsonb_build_array(
      jsonb_build_object(
        'slug', v_slug,
        'name', COALESCE(v_item->>'name',''),
        'size', v_size,
        'quantity', v_qty,
        'price', v_preco,
        'image', v_item->>'image'
      )
    );
  END LOOP;

  -- MVP: frete sempre pendente/servidor não aceita valor do cliente.
  v_total := v_subtotal;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Valor total inválido.';
  END IF;

  INSERT INTO public.pedidos (
    itens, valor_total, status, canal, idempotency_key, frete_status
  )
  VALUES (
    jsonb_build_object(
      'produtos', v_itens_normalizados,
      'cliente', p_cliente,
      'entrega', jsonb_build_object(
        'metodo', v_metodo_entrega,
        'endereco', p_entrega->'endereco',
        'retirada', p_entrega->'retirada',
        'frete',    jsonb_build_object('status','pendente','label','A combinar','cost', NULL)
      ),
      'pagamento', p_pagamento,
      'observacoes', p_observacoes,
      'subtotal', v_subtotal,
      'frete', 0
    ),
    v_total,
    'novo',
    COALESCE(p_canal, 'whatsapp'),
    NULLIF(p_idempotency_key, ''),
    'pendente'
  )
  RETURNING pedidos.id, pedidos.numero_pedido INTO v_id, v_numero;

  RETURN QUERY SELECT v_id, v_numero, v_total;
END $function$;

-- Garante execução por anon/authenticated (idempotente).
REVOKE ALL ON FUNCTION public.criar_pedido(jsonb,jsonb,jsonb,jsonb,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_pedido(jsonb,jsonb,jsonb,jsonb,text,text,text)
  TO anon, authenticated;

-- Remove assinatura antiga (sem idempotency_key), se existir, para evitar ambiguidade.
DROP FUNCTION IF EXISTS public.criar_pedido(jsonb,jsonb,jsonb,jsonb,text,text);

-- 3) transicionar_pedido — status + estoque numa única transação --------------
CREATE OR REPLACE FUNCTION public.transicionar_pedido(
  p_pedido_id uuid,
  p_novo_status text,
  p_responsavel text DEFAULT NULL
)
RETURNS public.pedidos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_produto record;
  v_item jsonb;
  v_qty int;
  v_size text;
  v_slug text;
  v_current int;
  v_produto_id uuid;
  v_consumir boolean := false;
  v_estornar boolean := false;
BEGIN
  IF v_uid IS NULL OR NOT (
    public.has_role(v_uid,'admin') OR public.has_role(v_uid,'atendente')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para transicionar pedidos.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  -- Mesma → mesma: no-op idempotente.
  IF v_pedido.status = p_novo_status THEN
    RETURN v_pedido;
  END IF;

  -- Validação forte (a trigger pedidos_guard_update também bloqueia).
  IF NOT EXISTS (
    SELECT 1 FROM public.pedido_transicoes
     WHERE de = v_pedido.status AND para = p_novo_status
  ) THEN
    RAISE EXCEPTION 'Transição inválida: % → %.', v_pedido.status, p_novo_status
      USING ERRCODE = '23514';
  END IF;

  -- Regra ÚNICA de consumo/estorno.
  -- Consumo: primeira vez que o pedido entra em 'separado' ou 'reservado'.
  -- Estorno: cancelamento com consumo previamente aplicado.
  IF p_novo_status IN ('separado','reservado') AND NOT v_pedido.consumo_aplicado THEN
    v_consumir := true;
  ELSIF p_novo_status = 'cancelado' AND v_pedido.consumo_aplicado THEN
    v_estornar := true;
  END IF;

  IF v_consumir OR v_estornar THEN
    -- Percorre itens do pedido; bloqueia cada variação (FOR UPDATE) por slug+tam.
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_pedido.itens->'produtos') LOOP
      v_slug := v_item->>'slug';
      v_size := v_item->>'size';
      v_qty  := COALESCE((v_item->>'quantity')::int, 0);
      IF v_slug IS NULL OR v_size IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

      SELECT id INTO v_produto_id FROM public.produtos WHERE slug = v_slug;
      IF v_produto_id IS NULL THEN
        RAISE EXCEPTION 'Produto do pedido não localizado (%).', v_slug;
      END IF;

      SELECT quantidade INTO v_current
        FROM public.produto_variacoes
       WHERE produto_id = v_produto_id AND tamanho = v_size
       FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variação % / % ausente.', v_slug, v_size;
      END IF;

      IF v_consumir THEN
        IF v_current < v_qty THEN
          RAISE EXCEPTION 'Estoque insuficiente para % tam % (atual %, precisa %).',
            v_slug, v_size, v_current, v_qty;
        END IF;
        UPDATE public.produto_variacoes
           SET quantidade = quantidade - v_qty
         WHERE produto_id = v_produto_id AND tamanho = v_size;
        INSERT INTO public.produto_movimentacoes
          (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id)
        VALUES
          (v_produto_id, v_size, 'consumo_pedido', -v_qty, v_uid,
           format('Pedido %s', v_pedido.numero_pedido), v_pedido.id);
      ELSE  -- estornar
        UPDATE public.produto_variacoes
           SET quantidade = quantidade + v_qty
         WHERE produto_id = v_produto_id AND tamanho = v_size;
        INSERT INTO public.produto_movimentacoes
          (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id)
        VALUES
          (v_produto_id, v_size, 'entrada', v_qty, v_uid,
           format('Estorno do pedido %s', v_pedido.numero_pedido), v_pedido.id);
      END IF;
    END LOOP;
  END IF;

  UPDATE public.pedidos
     SET status = p_novo_status,
         atualizado_em = now(),
         atendente_nome = COALESCE(p_responsavel, atendente_nome),
         consumo_aplicado = CASE
           WHEN v_consumir THEN true
           WHEN v_estornar THEN false
           ELSE consumo_aplicado
         END
   WHERE id = p_pedido_id
   RETURNING * INTO v_pedido;

  RETURN v_pedido;
END $function$;

REVOKE ALL ON FUNCTION public.transicionar_pedido(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transicionar_pedido(uuid,text,text) TO authenticated;
