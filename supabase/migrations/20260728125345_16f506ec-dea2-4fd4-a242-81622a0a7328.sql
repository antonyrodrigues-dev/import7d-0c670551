CREATE OR REPLACE FUNCTION public.transicionar_pedido(p_pedido_id uuid, p_novo_status text)
 RETURNS pedidos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_nome text;
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

  -- Nome resolvido pelo perfil — nunca confiado ao frontend.
  SELECT NULLIF(btrim(pf.nome), '')
    INTO v_nome FROM public.profiles pf WHERE pf.user_id = v_uid;
  v_nome := COALESCE(v_nome, 'Equipe 7D');

  SELECT * INTO v_pedido FROM public.pedidos WHERE pedidos.id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_pedido.status = p_novo_status THEN
    RETURN v_pedido;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pedido_transicoes
     WHERE de = v_pedido.status AND para = p_novo_status
  ) THEN
    RAISE EXCEPTION 'Transição inválida: % → %.', v_pedido.status, p_novo_status
      USING ERRCODE = '23514';
  END IF;

  IF p_novo_status IN ('separado','reservado') AND NOT v_pedido.consumo_aplicado THEN
    v_consumir := true;
  ELSIF p_novo_status = 'cancelado' AND v_pedido.consumo_aplicado THEN
    v_estornar := true;
  END IF;

  IF v_consumir OR v_estornar THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_pedido.itens->'produtos') LOOP
      v_slug := v_item->>'slug';
      v_size := v_item->>'size';
      v_qty  := COALESCE((v_item->>'quantity')::int, 0);
      IF v_slug IS NULL OR v_size IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

      SELECT produtos.id INTO v_produto_id FROM public.produtos WHERE produtos.slug = v_slug;
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
        UPDATE public.produto_variacoes SET quantidade = quantidade - v_qty
         WHERE produto_id = v_produto_id AND tamanho = v_size;
        INSERT INTO public.produto_movimentacoes
          (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id)
        VALUES (v_produto_id, v_size, 'consumo_pedido', -v_qty, v_uid,
                format('Pedido %s', v_pedido.numero_pedido), v_pedido.id);
      ELSE
        UPDATE public.produto_variacoes SET quantidade = quantidade + v_qty
         WHERE produto_id = v_produto_id AND tamanho = v_size;
        INSERT INTO public.produto_movimentacoes
          (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id)
        VALUES (v_produto_id, v_size, 'entrada', v_qty, v_uid,
                format('Estorno do pedido %s', v_pedido.numero_pedido), v_pedido.id);
      END IF;
    END LOOP;
  END IF;

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET status = p_novo_status,
         atualizado_em = now(),
         responsavel_id = COALESCE(pedidos.responsavel_id, v_uid),
         atendente_nome = COALESCE(pedidos.atendente_nome, v_nome),
         consumo_aplicado = CASE
           WHEN v_consumir THEN true
           WHEN v_estornar THEN false
           ELSE pedidos.consumo_aplicado
         END
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'pedido.status', 'equipe', v_uid,
          jsonb_build_object('para', p_novo_status));

  RETURN v_pedido;
END $function$;