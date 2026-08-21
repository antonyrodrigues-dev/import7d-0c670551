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
  v_qtd_vendida int; v_qtd_devolvida int;
  v_integral boolean;
  v_motivo text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'Somente o Admin Master aprova devoluções.' USING ERRCODE = '42501';
  END IF;
  v_motivo := btrim(COALESCE(p_motivo,''));
  IF NOT public.devolucao_motivo_valido(v_motivo) THEN
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
  VALUES (p_pedido_id, v_motivo, COALESCE(p_valor_estornado,0), p_observacoes,
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
      RAISE EXCEPTION 'Condição da peça inválida: %', v_cond USING ERRCODE = '22023';
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
              v_current, v_current + v_qty, v_motivo);
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
              v_current, v_current + v_qty, format('%s (%s)', v_motivo, v_cond));
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

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET valor_devolvido = valor_devolvido + COALESCE(p_valor_estornado,0),
         atualizado_em = now()
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  IF COALESCE(p_valor_estornado,0) > 0 THEN
    PERFORM public.lancar_financeiro(v_pedido, 'estorno', 'devolucao',
      -COALESCE(p_valor_estornado,0), v_dev_id,
      jsonb_build_object('motivo', v_motivo));
  END IF;

  SELECT COALESCE(SUM((p->>'quantity')::int),0) INTO v_qtd_vendida
    FROM jsonb_array_elements(v_pedido.itens->'produtos') p;
  SELECT COALESCE(SUM(di.quantidade),0) INTO v_qtd_devolvida
    FROM public.pedido_devolucao_itens di
    JOIN public.pedido_devolucoes d ON d.id = di.devolucao_id
   WHERE d.pedido_id = p_pedido_id;
  v_integral := v_qtd_devolvida >= v_qtd_vendida;

  IF v_integral AND v_pedido.status <> 'devolvido' THEN
    PERFORM set_config('app.rpc_ctx','on', true);
    UPDATE public.pedidos SET status = 'devolvido', atualizado_em = now()
     WHERE pedidos.id = p_pedido_id;
    PERFORM set_config('app.rpc_ctx','off', true);
  END IF;

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (p_pedido_id, v_pedido.numero_pedido, 'pedido.devolucao', 'equipe', v_uid,
          jsonb_build_object('motivo', v_motivo, 'valor', COALESCE(p_valor_estornado,0),
                             'integral', v_integral, 'devolucao_id', v_dev_id));

  RETURN v_dev_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_devolucao(uuid, jsonb, text, numeric, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_devolucao(uuid, jsonb, text, numeric, text, jsonb) TO authenticated;