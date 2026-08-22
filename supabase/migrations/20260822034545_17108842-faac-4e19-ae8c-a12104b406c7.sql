CREATE OR REPLACE FUNCTION public.resolver_pendencias_pedido(
  p_pedido_id uuid,
  p_itens jsonb,
  p_motivo_preco text DEFAULT NULL
)
RETURNS public.pedidos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_item jsonb; v_idx int := 0;
  v_slug text; v_size text; v_qty int;
  v_preco numeric; v_preco_catalogo numeric; v_preco_enviado numeric;
  v_prod record; v_var record; v_saldo int;
  v_novos jsonb := '[]'::jsonb; v_subtotal numeric := 0;
  v_overrides jsonb := '[]'::jsonb;
  v_expira timestamptz; v_snapshot jsonb;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'atendente')) THEN
    RAISE EXCEPTION 'Sem permissão para resolver pendências.' USING ERRCODE = '42501';
  END IF;
  v_is_admin := public.has_role(v_uid,'admin');

  SELECT * INTO v_pedido FROM public.pedidos WHERE pedidos.id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF NOT v_is_admin AND v_pedido.responsavel_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Este pedido pertence a outro atendente.' USING ERRCODE = '42501';
  END IF;
  IF v_pedido.status IN ('cancelado','devolvido','entregue') THEN
    RAISE EXCEPTION 'Pedido % não aceita ajuste de pendências.', v_pedido.status USING ERRCODE = '23514';
  END IF;
  IF NOT (v_pedido.pendencia_preco OR v_pedido.pendencia_tamanho) THEN
    RETURN v_pedido;
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array'
     OR jsonb_array_length(p_itens) <> jsonb_array_length(v_pedido.itens->'produtos') THEN
    RAISE EXCEPTION 'Lista de itens inconsistente com o pedido.' USING ERRCODE = '22023';
  END IF;

  v_expira := now() + make_interval(mins => public.reserva_minutos());

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_pedido.itens->'produtos') LOOP
    v_slug := v_item->>'slug';
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    v_size := COALESCE(NULLIF(btrim(COALESCE(p_itens->v_idx->>'size', v_item->>'size')),''), '');
    v_preco_enviado := NULLIF(p_itens->v_idx->>'price','')::numeric;
    v_idx := v_idx + 1;

    IF v_size = '' THEN
      RAISE EXCEPTION 'Defina o tamanho de %.', v_slug USING ERRCODE = '22023';
    END IF;

    SELECT pr.id, pr.nome, pr.modelo_estoque, pr.preco, pr.preco_status,
           COALESCE(pr.imagens->>0,'') AS imagem
      INTO v_prod FROM public.produtos pr WHERE pr.slug = v_slug;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto % não encontrado.', v_slug USING ERRCODE = 'P0002';
    END IF;

    -- ── Autoridade de preço: SEMPRE o catálogo. ──────────────────────────
    v_preco_catalogo := v_prod.preco;
    IF v_prod.preco_status IS DISTINCT FROM 'confirmado'
       OR v_preco_catalogo IS NULL OR v_preco_catalogo <= 0 THEN
      v_preco_catalogo := NULL;
    END IF;

    IF v_is_admin AND v_preco_enviado IS NOT NULL AND v_preco_enviado > 0
       AND (v_preco_catalogo IS NULL OR v_preco_enviado <> v_preco_catalogo) THEN
      IF NULLIF(btrim(COALESCE(p_motivo_preco,'')),'') IS NULL THEN
        RAISE EXCEPTION 'Preço excepcional exige motivo registrado.' USING ERRCODE = '22023';
      END IF;
      v_preco := v_preco_enviado;
      v_overrides := v_overrides || jsonb_build_array(jsonb_build_object(
        'slug', v_slug, 'antes', v_preco_catalogo, 'depois', v_preco_enviado));
    ELSE
      v_preco := v_preco_catalogo;
    END IF;

    IF v_preco IS NULL OR v_preco <= 0 THEN
      RAISE EXCEPTION 'Preço de % não está confirmado no catálogo. Ajuste o catálogo antes de confirmar.', v_slug
        USING ERRCODE = '22023';
    END IF;

    -- Reserva apenas o que ainda não está reservado para este pedido
    IF v_prod.modelo_estoque <> 'kit' AND NOT EXISTS (
      SELECT 1 FROM public.reservas_estoque r
       WHERE r.pedido_id = v_pedido.id AND r.produto_id = v_prod.id
         AND r.tamanho = v_size AND r.estado = 'ativa'
    ) THEN
      PERFORM public.expirar_reservas_variacao(v_prod.id, v_size);
      SELECT pv.disponivel AS disponivel, pv.origem_tamanho AS origem INTO v_var
        FROM public.produto_variacoes pv
       WHERE pv.produto_id = v_prod.id AND pv.tamanho = v_size FOR UPDATE;
      IF NOT FOUND OR v_var.origem NOT IN ('confirmado_etiqueta','confirmado_medicao') THEN
        RAISE EXCEPTION 'Tamanho % indisponível para %.', v_size, v_slug USING ERRCODE = '22023';
      END IF;
      v_saldo := GREATEST(COALESCE(v_var.disponivel,0),0);
      IF v_saldo < v_qty THEN
        RAISE EXCEPTION 'Estoque insuficiente para % tam % (disponível %).', v_slug, v_size, v_saldo
          USING ERRCODE = '22023';
      END IF;

      UPDATE public.produto_variacoes
         SET quantidade_reservada = quantidade_reservada + v_qty, atualizado_em = now()
       WHERE produto_id = v_prod.id AND tamanho = v_size;

      INSERT INTO public.reservas_estoque (pedido_id, produto_id, tamanho, quantidade, expira_em)
      VALUES (v_pedido.id, v_prod.id, v_size, v_qty, v_expira);

      INSERT INTO public.produto_movimentacoes
        (produto_id, tamanho, tipo, quantidade, motivo, observacao, pedido_id, por_usuario)
      VALUES (v_prod.id, v_size, 'reserva', v_qty, 'checkout',
              format('Reserva confirmada no atendimento do pedido %s', v_pedido.numero_pedido),
              v_pedido.id, v_uid);
    END IF;

    v_subtotal := v_subtotal + v_preco * v_qty;
    v_novos := v_novos || jsonb_build_array(
      v_item || jsonb_build_object('size', v_size, 'price', v_preco,
                                   'precoPendente', false, 'tamanhoPendente', false));
  END LOOP;

  v_snapshot := jsonb_set(v_pedido.itens, '{produtos}', v_novos);
  v_snapshot := jsonb_set(v_snapshot, '{subtotal}', to_jsonb(v_subtotal));
  v_snapshot := jsonb_set(v_snapshot, '{pendencias}',
                          jsonb_build_object('preco', false, 'tamanho', false));

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET itens = v_snapshot,
         valor_total = v_subtotal + COALESCE((v_snapshot->>'frete')::numeric, 0),
         pendencia_preco = false, pendencia_tamanho = false,
         atualizado_em = now()
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'pedido.pendencias_resolvidas', 'equipe', v_uid,
          jsonb_build_object('valor_total', v_pedido.valor_total));

  IF jsonb_array_length(v_overrides) > 0 THEN
    INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
    VALUES (v_pedido.id, v_pedido.numero_pedido, 'pedido.preco_excepcional', 'equipe', v_uid,
            jsonb_build_object('motivo', btrim(p_motivo_preco), 'itens', v_overrides));
  END IF;

  RETURN v_pedido;
END
$fn$;