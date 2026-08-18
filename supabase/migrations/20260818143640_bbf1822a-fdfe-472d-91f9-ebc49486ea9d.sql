-- FIN-01 / FIN-02: pagamento tem uma única autoridade e cancelamento de pedido pago exige estorno atômico.

CREATE OR REPLACE FUNCTION public.transicionar_pedido(p_pedido_id uuid, p_novo_status text)
 RETURNS pedidos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_nome text;
  v_item jsonb;
  v_qty int;
  v_size text;
  v_slug text;
  v_current int;
  v_linha record;
  v_consumir boolean := false;
  v_estornar boolean := false;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'atendente')) THEN
    RAISE EXCEPTION 'Sem permissão para transicionar pedidos.' USING ERRCODE = '42501';
  END IF;
  v_admin := public.has_role(v_uid,'admin');

  SELECT NULLIF(btrim(pf.nome), '') INTO v_nome FROM public.profiles pf WHERE pf.user_id = v_uid;
  v_nome := COALESCE(v_nome, 'Equipe 7D');

  SELECT * INTO v_pedido FROM public.pedidos WHERE pedidos.id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_admin AND v_pedido.responsavel_id IS NOT NULL AND v_pedido.responsavel_id <> v_uid THEN
    RAISE EXCEPTION 'Este pedido pertence a outro atendente.' USING ERRCODE = '42501';
  END IF;

  IF v_pedido.status = p_novo_status THEN
    RETURN v_pedido;
  END IF;

  -- Autoridade única de pagamento: o status nunca confirma pagamento.
  IF p_novo_status = 'pagamento_confirmado'
     AND current_setting('app.pagamento_ctx', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Confirmação de pagamento só pelo módulo financeiro.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pedido_transicoes WHERE de = v_pedido.status AND para = p_novo_status
  ) THEN
    RAISE EXCEPTION 'Transição inválida: % → %.', v_pedido.status, p_novo_status
      USING ERRCODE = '23514';
  END IF;

  -- Pedido pago só cancela pelo comando canônico (que estorna antes).
  IF p_novo_status = 'cancelado' AND v_pedido.pagamento_estado = 'confirmado' THEN
    RAISE EXCEPTION 'Pedido pago exige estorno: use cancelar pedido com estorno.' USING ERRCODE = '23514';
  END IF;
  IF p_novo_status = 'devolvido' THEN
    RAISE EXCEPTION 'Use o fluxo de devolução para registrar a devolução.' USING ERRCODE = '23514';
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

      FOR v_linha IN
        SELECT * FROM public.explodir_item_pedido(v_slug, v_size, v_qty)
      LOOP
        SELECT quantidade INTO v_current
          FROM public.produto_variacoes
         WHERE produto_id = v_linha.produto_id AND tamanho = v_linha.tamanho
         FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Variação % / % ausente.', v_slug, v_linha.tamanho;
        END IF;

        IF v_consumir THEN
          IF v_current < v_linha.quantidade THEN
            RAISE EXCEPTION 'Estoque insuficiente para % tam % (atual %, precisa %).',
              v_slug, v_linha.tamanho, v_current, v_linha.quantidade;
          END IF;
          UPDATE public.produto_variacoes SET quantidade = quantidade - v_linha.quantidade
           WHERE produto_id = v_linha.produto_id AND tamanho = v_linha.tamanho;
          INSERT INTO public.produto_movimentacoes
            (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id,
             saldo_anterior, saldo_posterior, motivo)
          VALUES (v_linha.produto_id, v_linha.tamanho, 'consumo_pedido', -v_linha.quantidade, v_uid,
                  format('Pedido %s', v_pedido.numero_pedido), v_pedido.id,
                  v_current, v_current - v_linha.quantidade, 'venda');
        ELSE
          UPDATE public.produto_variacoes SET quantidade = quantidade + v_linha.quantidade
           WHERE produto_id = v_linha.produto_id AND tamanho = v_linha.tamanho;
          INSERT INTO public.produto_movimentacoes
            (produto_id, tamanho, tipo, quantidade, por_usuario, observacao, pedido_id,
             saldo_anterior, saldo_posterior, motivo)
          VALUES (v_linha.produto_id, v_linha.tamanho, 'entrada', v_linha.quantidade, v_uid,
                  format('Estorno do pedido %s', v_pedido.numero_pedido), v_pedido.id,
                  v_current, v_current + v_linha.quantidade, 'cancelamento');
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  IF v_consumir THEN
    PERFORM public.converter_reservas_pedido(v_pedido.id);
  ELSIF p_novo_status = 'cancelado' THEN
    PERFORM public.liberar_reservas_pedido(v_pedido.id, 'cancelamento_equipe');
  END IF;

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET status = p_novo_status,
         atualizado_em = now(),
         responsavel_id = COALESCE(pedidos.responsavel_id, v_uid),
         atendente_nome = COALESCE(pedidos.atendente_nome, v_nome),
         atribuido_em = COALESCE(pedidos.atribuido_em, now()),
         consumo_aplicado = CASE
           WHEN v_consumir THEN true
           WHEN v_estornar THEN false
           ELSE pedidos.consumo_aplicado END
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'pedido.status', 'equipe', v_uid,
          jsonb_build_object('para', p_novo_status));

  RETURN v_pedido;
END $function$;

-- registrar_pagamento: autoridade única. Ao confirmar, sincroniza o status
-- operacional do pedido na MESMA transação (quando a transição é oficial).
CREATE OR REPLACE FUNCTION public.registrar_pagamento(p_pedido_id uuid, p_estado text, p_comprovante_url text DEFAULT NULL::text, p_observacao text DEFAULT NULL::text)
 RETURNS pedidos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_de text;
  v_liquido numeric;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'atendente')) THEN
    RAISE EXCEPTION 'Sem permissão para registrar pagamento.' USING ERRCODE = '42501';
  END IF;
  v_admin := public.has_role(v_uid,'admin');
  IF p_estado NOT IN ('pendente','aguardando_comprovante','em_analise','confirmado','recusado','estornado') THEN
    RAISE EXCEPTION 'Estado de pagamento inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_estado IN ('confirmado','estornado') AND NOT v_admin THEN
    RAISE EXCEPTION 'Somente o Admin Master confirma ou estorna pagamento.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE pedidos.id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_admin AND v_pedido.responsavel_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Este pedido pertence a outro atendente.' USING ERRCODE = '42501';
  END IF;

  IF v_pedido.pagamento_estado = p_estado THEN
    RETURN v_pedido; -- idempotente
  END IF;

  v_de := v_pedido.pagamento_estado;
  IF NOT EXISTS (SELECT 1 FROM public.pagamento_transicoes t WHERE t.de = v_de AND t.para = p_estado) THEN
    RAISE EXCEPTION 'Transição de pagamento não permitida: % -> %.', v_de, p_estado USING ERRCODE = '23514';
  END IF;

  IF p_estado = 'confirmado' AND v_pedido.status IN ('cancelado','devolvido') THEN
    RAISE EXCEPTION 'Pedido % não aceita confirmação de pagamento.', v_pedido.status USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('app.rpc_ctx','on', true);
  UPDATE public.pedidos
     SET pagamento_estado = p_estado, atualizado_em = now()
   WHERE pedidos.id = p_pedido_id
   RETURNING * INTO v_pedido;
  PERFORM set_config('app.rpc_ctx','off', true);

  INSERT INTO public.pedido_pagamentos
    (pedido_id, estado, valor, comprovante_url, observacao, por_usuario)
  VALUES (v_pedido.id, p_estado, v_pedido.valor_total, p_comprovante_url, p_observacao, v_uid);

  IF p_estado = 'confirmado' THEN
    PERFORM public.lancar_financeiro(v_pedido, 'receita', 'pagamento', v_pedido.valor_total, v_pedido.id,
      jsonb_build_object('observacao', p_observacao));

    -- Sincroniza o estado operacional na mesma transação, se a máquina permitir.
    IF v_pedido.status <> 'pagamento_confirmado'
       AND EXISTS (SELECT 1 FROM public.pedido_transicoes t
                    WHERE t.de = v_pedido.status AND t.para = 'pagamento_confirmado') THEN
      PERFORM set_config('app.pagamento_ctx','on', true);
      v_pedido := public.transicionar_pedido(v_pedido.id, 'pagamento_confirmado');
      PERFORM set_config('app.pagamento_ctx','off', true);
    END IF;
  ELSIF p_estado = 'estornado' THEN
    SELECT COALESCE(SUM(valor),0) INTO v_liquido
      FROM public.financeiro_lancamentos WHERE pedido_id = v_pedido.id;
    IF v_liquido > 0 THEN
      PERFORM public.lancar_financeiro(v_pedido, 'estorno', 'pagamento', v_liquido, v_pedido.id,
        jsonb_build_object('motivo', COALESCE(p_observacao,'Estorno de pagamento')));
    END IF;
  END IF;

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'pagamento.estado', 'equipe', v_uid,
          jsonb_build_object('de', v_de, 'estado', p_estado));

  RETURN v_pedido;
END;
$function$;

-- Comando canônico: cancelar pedido pago = estorno + estoque + status + histórico
-- em uma única transação. Admin Master apenas.
CREATE OR REPLACE FUNCTION public.cancelar_pedido_com_estorno(p_pedido_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS pedidos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'Somente o Admin Master cancela pedido pago.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE pedidos.id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.status = 'cancelado' THEN
    RETURN v_pedido; -- idempotente
  END IF;

  IF v_pedido.pagamento_estado = 'confirmado' THEN
    v_pedido := public.registrar_pagamento(
      p_pedido_id, 'estornado', NULL,
      COALESCE(p_motivo, 'Cancelamento administrativo com estorno'));
  END IF;

  v_pedido := public.transicionar_pedido(p_pedido_id, 'cancelado');

  INSERT INTO public.pedido_eventos (pedido_id, numero_pedido, tipo, origem, por_usuario, detalhe)
  VALUES (v_pedido.id, v_pedido.numero_pedido, 'pedido.cancelado_com_estorno', 'equipe', v_uid,
          jsonb_build_object('motivo', p_motivo));

  RETURN v_pedido;
END $function$;

REVOKE ALL ON FUNCTION public.cancelar_pedido_com_estorno(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido_com_estorno(uuid, text) TO authenticated;