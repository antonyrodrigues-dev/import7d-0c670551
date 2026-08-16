-- 1) Devolução parcial não encerra o pedido
CREATE OR REPLACE FUNCTION public.registrar_devolucao(p_pedido_id uuid, p_itens jsonb, p_motivo text, p_valor_estornado numeric DEFAULT 0, p_observacoes text DEFAULT NULL::text, p_evidencias jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_dev_id uuid;
  v_item jsonb;
  v_slug text; v_size text; v_qty int; v_cond text;
  v_produto_id uuid; v_current int;
  v_vendido int; v_ja_devolvido int;
  v_total_devolvido numeric;
  v_qtd_vendida int;
  v_qtd_devolvida int;
  v_integral boolean;
  v_novo_status text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'Somente o Admin Master aprova devoluções.' USING ERRCODE = '42501';
  END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Motivo da devolução é obrigatório.' USING ERRCODE = '22023';
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Devolução sem itens.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE pedidos.id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.status NOT IN ('finalizado','devolvido') THEN
    RAISE EXCEPTION 'Somente pedidos finalizados podem ser devolvidos.' USING ERRCODE = '23514';
  END IF;
  IF COALESCE(p_valor_estornado,0) < 0
     OR (v_pedido.valor_devolvido + COALESCE(p_valor_estornado,0)) > v_pedido.valor_total THEN
    RAISE EXCEPTION 'Valor estornado excede o total do pedido.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pedido_devolucoes
    (pedido_id, motivo, valor_estornado, observacoes, evidencias, aprovado_por)
  VALUES (p_pedido_id, btrim(p_motivo), COALESCE(p_valor_estornado,0), p_observacoes,
          COALESCE(p_evidencias,'[]'::jsonb), v_uid)
  RETURNING id INTO v_dev_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_slug := btrim(COALESCE(v_item->>'slug',''));
    v_size := btrim(COALESCE(v_item->>'size',''));
    v_qty  := COALESCE((v_item->>'quantity')::int, 0);
    v_cond := COALESCE(v_item->>'condicao','');
    IF v_slug = '' OR v_size = '' OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Item de devolução inválido.' USING ERRCODE = '22023';
    END IF;
    IF v_cond NOT IN ('vendavel','usada','avariada','defeituosa','divergencia','outra') THEN
      RAISE EXCEPTION 'Condição da peça inválida.' USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(SUM((p->>'quantity')::int), 0) INTO v_vendido
      FROM jsonb_array_elements(v_pedido.itens->'produtos') p
     WHERE p->>'slug' = v_slug AND p->>'size' = v_size;

    SELECT COALESCE(SUM(di.quantidade), 0) INTO v_ja_devolvido
      FROM public.pedido_devolucao_itens di
      JOIN public.pedido_devolucoes d ON d.id = di.devolucao_id
     WHERE d.pedido_id = p_pedido_id AND di.slug = v_slug AND di.tamanho = v_size
       AND di.devolucao_id <> v_dev_id;

    IF (v_ja_devolvido + v_qty) > v_vendido THEN
      RAISE EXCEPTION 'Quantidade devolvida maior que a vendida (% tam %).', v_slug, v_size
        USING ERRCODE = '22023';
    END IF;

    SELECT produtos.id INTO v_produto_id FROM public.produtos WHERE produtos.slug = v_slug;
    IF v_produto_id IS NULL THEN
      RAISE EXCEPTION 'Produto da devolução não localizado (%).', v_slug USING ERRCODE = 'P0002';
    END IF;

    SELECT quantidade INTO v_current
      FROM public.produto_variacoes
     WHERE produto_id = v_produto_id AND tamanho = v_size
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variação % / % ausente.', v_slug, v_size USING ERRCODE = 'P0002';
    END IF;

    IF v_cond = 'vendavel' THEN
      UPDATE public.produto_variacoes
         SET quantidade = quantidade + v_qty, atualizado_em = now()
       WHERE produto_id = v_produto_id AND tamanho = v_size;
      INSERT INTO public.produto_movimentacoes
        (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id,
         saldo_anterior, saldo_posterior, motivo)
      VALUES (v_produto_id, v_size, 'devolucao', v_qty, v_uid,
              format('Devolução do pedido %s', v_pedido.numero_pedido), v_pedido.id,
              v_current, v_current + v_qty, btrim(p_motivo));
    ELSE
      UPDATE public.produto_variacoes
         SET quantidade = quantidade + v_qty,
             quantidade_quarentena = quantidade_quarentena + v_qty,
             atualizado_em = now()
       WHERE produto_id = v_produto_id AND tamanho = v_size;
      INSERT INTO public.produto_movimentacoes
        (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id,
         saldo_anterior, saldo_posterior, motivo)
      VALUES (v_produto_id, v_size, 'quarentena', v_qty, v_uid,
              format('Quarentena — devolução do pedido %s', v_pedido.numero_pedido), v_pedido.id,
              v_current, v_current + v_qty, format('%s (%s)', btrim(p_motivo), v_cond));
      PERFORM public.emitir_notificacao(
        'estoque.quarentena', 'Peça enviada à quarentena',
        format('%s (%s) — %s un. do pedido %s', v_slug, v_size, v_qty, v_pedido.numero_pedido),
        'estoque.quarentena:' || v_dev_id::text || ':' || v_slug || ':' || v_size,
        'alerta', 'produto', v_produto_id, jsonb_build_object('condicao', v_cond));
    END IF;

    INSERT INTO public.pedido_devolucao_itens
      (devolucao_id, produto_id, slug, tamanho, quantidade, condicao, retornou_estoque)
    VALUES (v_dev_id, v_produto_id, v_slug, v_size, v_qty, v_cond, v_cond = 'vendavel');
  END LOOP;

  v_total_devolvido := v_pedido.valor_devolvido + COALESCE(p_valor_estornado,0);

  -- Devolução é INTEGRAL apenas quando todas as peças vendidas voltaram
  -- OU o valor devolvido alcançou o total do pedido. Caso contrário o pedido
  -- permanece finalizado (venda parcial preservada no financeiro).
  SELECT COALESCE(SUM((p->>'quantity')::int),0) INTO v_qtd_vendida
    FROM jsonb_array_elements(v_pedido.itens->'produtos') p;
  SELECT COALESCE(SUM(di.quantidade),0) INTO v_qtd_devolvida
    FROM public.pedido_devolucao_itens di
    JOIN public.pedido_devolucoes d ON d.id = di.devolucao_id
   WHERE d.pedido_id = p_pedido_id;

  v_integral := (v_qtd_vendida > 0 AND v_qtd_devolvida >= v_qtd_vendida)
                OR (v_pedido.valor_total > 0 AND v_total_devolvido >= v_pedido.valor_total);
  v_novo_status := CASE WHEN v_integral THEN 'devolvido' ELSE v_pedido.status END;

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET status = v_novo_status,
         valor_devolvido = v_total_devolvido,
         pagamento_estado = CASE
             WHEN pedidos.pagamento_estado = 'confirmado' AND v_total_devolvido >= pedidos.valor_total
               THEN 'estornado' ELSE pedidos.pagamento_estado END,
         atualizado_em = now()
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  IF COALESCE(p_valor_estornado,0) > 0 THEN
    PERFORM public.lancar_financeiro(v_pedido, 'estorno', 'devolucao', p_valor_estornado, v_dev_id,
      jsonb_build_object('motivo', btrim(p_motivo), 'integral', v_integral));
  END IF;

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (p_pedido_id, v_pedido.numero_pedido,
          CASE WHEN v_integral THEN 'pedido.devolvido' ELSE 'pedido.devolucao_parcial' END,
          'equipe', v_uid,
          jsonb_build_object('devolucao_id', v_dev_id,
                             'valor_estornado', COALESCE(p_valor_estornado,0),
                             'integral', v_integral));

  RETURN v_dev_id;
END;
$function$;

-- 2) Frete oficial definido no servidor
CREATE OR REPLACE FUNCTION public.definir_frete_pedido(p_pedido_id uuid, p_valor numeric)
 RETURNS public.pedidos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_subtotal numeric;
  v_metodo text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'Somente o Admin Master define o frete.' USING ERRCODE = '42501';
  END IF;
  IF p_valor IS NULL OR p_valor < 0 THEN
    RAISE EXCEPTION 'Valor de frete inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE pedidos.id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.pagamento_estado = 'confirmado' THEN
    RAISE EXCEPTION 'Pagamento já confirmado: o frete não pode mais ser alterado.'
      USING ERRCODE = '23514';
  END IF;
  IF v_pedido.status IN ('cancelado','devolvido') THEN
    RAISE EXCEPTION 'Pedido encerrado: frete não pode ser alterado.' USING ERRCODE = '23514';
  END IF;

  v_metodo := v_pedido.itens->'entrega'->>'metodo';
  IF v_metodo = 'retirada' AND p_valor > 0 THEN
    RAISE EXCEPTION 'Pedido de retirada não tem frete.' USING ERRCODE = '22023';
  END IF;

  v_subtotal := COALESCE((v_pedido.itens->>'subtotal')::numeric, v_pedido.valor_total);

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET itens = jsonb_set(
           jsonb_set(pedidos.itens, '{frete}', to_jsonb(p_valor), true),
           '{entrega,frete}',
           jsonb_build_object('status','definido',
                              'label', CASE WHEN p_valor = 0 THEN 'Sem custo' ELSE 'Frete definido' END,
                              'cost', p_valor),
           true),
         valor_total = v_subtotal + p_valor,
         frete_status = 'definido',
         atualizado_em = now()
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  UPDATE public.pedido_pagamentos
     SET valor = v_pedido.valor_total
   WHERE pedido_id = p_pedido_id AND estado = 'pendente';

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (p_pedido_id, v_pedido.numero_pedido, 'pedido.frete_definido', 'equipe', v_uid,
          jsonb_build_object('valor', p_valor, 'total', v_pedido.valor_total));

  RETURN v_pedido;
END;
$function$;

REVOKE ALL ON FUNCTION public.definir_frete_pedido(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_frete_pedido(uuid, numeric) TO authenticated;