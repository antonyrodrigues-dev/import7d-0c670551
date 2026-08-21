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

  IF (v_pedido.pendencia_preco OR v_pedido.pendencia_tamanho)
     AND p_estado NOT IN ('pendente','recusado') THEN
    RAISE EXCEPTION 'Resolva as pendências de preço/tamanho antes de avançar o pagamento.'
      USING ERRCODE = '23514';
  END IF;

  IF v_pedido.pagamento_estado = p_estado THEN
    RETURN v_pedido;
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