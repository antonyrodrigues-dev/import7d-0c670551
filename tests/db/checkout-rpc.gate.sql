-- 7D IMPORTS — Gate de banco do checkout (RPCs de pedido).
-- Executa dentro de uma transação e faz ROLLBACK: nenhum pedido real é gravado.
-- Uso: psql -v ON_ERROR_STOP=1 -f tests/db/checkout-rpc.gate.sql
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE gate_result(nome text, ok boolean, detalhe text) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.check_(p_nome text, p_ok boolean, p_detalhe text DEFAULT '')
RETURNS void LANGUAGE sql AS $$ INSERT INTO gate_result VALUES (p_nome, p_ok, p_detalhe) $$;

DO $gate$
DECLARE
  v_cli jsonb := jsonb_build_object('nome','Cliente Gate','telefone','(31) 99999-8888','cpf','390.533.447-05');
  v_ent jsonb := jsonb_build_object('metodo','retirada','retirada',
      jsonb_build_object('date', to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1,'YYYY-MM-DD'),'time','10:00'));
  v_pag jsonb := jsonb_build_object('metodo','credito','parcelas',3);
  v_key text := 'gate-' || replace(gen_random_uuid()::text,'-','');
  r record; r2 record; snap jsonb; msg text;
  v_id uuid; v_id2 uuid;
BEGIN
  -- 1. Payload manipulado: nome/imagem/preço/subtotal do cliente são ignorados.
  SELECT * INTO r FROM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','polo-piquet-marfim','size','M','quantity',1,
      'price',1,'name','HACK','image','http://evil','subtotal',1)),
    v_cli, v_ent, v_pag, 'obs gate', 'whatsapp', v_key);
  snap := r.snapshot; v_id := r.id;
  PERFORM pg_temp.check_('01 pedido criado com snapshot oficial', r.numero_pedido LIKE '7D-%', r.numero_pedido);
  PERFORM pg_temp.check_('21 payload manipulado não altera preço/nome/total',
    (snap->'produtos'->0->>'price')::numeric = 690 AND snap->'produtos'->0->>'name' <> 'HACK'
    AND r.valor_total = 690, format('preco=%s total=%s', snap->'produtos'->0->>'price', r.valor_total));
  PERFORM pg_temp.check_('03 snapshot traz entrega e pagamento normalizados',
    snap->'entrega'->>'metodo' = 'retirada' AND snap->'pagamento'->>'metodo' = 'credito'
    AND (snap->'pagamento'->>'parcelas')::int = 3);

  -- 2. Idempotência: mesma chave devolve o MESMO pedido, sem duplicar.
  SELECT * INTO r2 FROM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','polo-piquet-marfim','size','M','quantity',1)),
    v_cli, v_ent, v_pag, NULL, 'whatsapp', v_key);
  PERFORM pg_temp.check_('09/10 mesma idempotency_key devolve o mesmo pedido', r2.id = v_id,
    format('%s vs %s', r2.id, v_id));
  PERFORM pg_temp.check_('09 nenhuma duplicidade gravada',
    (SELECT count(*) FROM public.pedidos WHERE idempotency_key = v_key) = 1);

  -- 3. Chave inválida é rejeitada.
  BEGIN
    PERFORM public.criar_pedido(jsonb_build_array(jsonb_build_object('slug','polo-piquet-marfim','size','M','quantity',1)),
      v_cli, v_ent, v_pag, NULL, 'whatsapp', '');
    PERFORM pg_temp.check_('04 chave vazia rejeitada', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.check_('04 chave vazia rejeitada', true, SQLERRM); END;
  BEGIN
    PERFORM public.criar_pedido(jsonb_build_array(jsonb_build_object('slug','polo-piquet-marfim','size','M','quantity',1)),
      v_cli, v_ent, v_pag, NULL, 'whatsapp', 'aaaaaaaaaaaaaaaaaaaa');
    PERFORM pg_temp.check_('04 chave sem entropia rejeitada', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.check_('04 chave sem entropia rejeitada', true, SQLERRM); END;

  -- 4. Itens repetidos são agregados em uma única linha.
  SELECT * INTO r FROM public.criar_pedido(
    jsonb_build_array(
      jsonb_build_object('slug','camisa-oxford-azul','size','G','quantity',1),
      jsonb_build_object('slug','camisa-oxford-azul','size','G','quantity',2)),
    v_cli, v_ent, jsonb_build_object('metodo','pix'), NULL, 'whatsapp',
    'gate-' || replace(gen_random_uuid()::text,'-',''));
  snap := r.snapshot;
  PERFORM pg_temp.check_('18 itens duplicados agregados em 1 linha',
    jsonb_array_length(snap->'produtos') = 1 AND (snap->'produtos'->0->>'quantity')::int = 3
    AND r.valor_total = 890 * 3, format('linhas=%s total=%s', jsonb_array_length(snap->'produtos'), r.valor_total));
  PERFORM pg_temp.check_('06 parcelas normalizadas fora do crédito',
    (snap->'pagamento'->>'parcelas')::int = 1);

  -- 5. Tamanho inexistente rejeitado.
  BEGIN
    PERFORM public.criar_pedido(jsonb_build_array(jsonb_build_object('slug','polo-piquet-marfim','size','XXG','quantity',1)),
      v_cli, v_ent, v_pag, NULL, 'whatsapp', 'gate-' || replace(gen_random_uuid()::text,'-',''));
    PERFORM pg_temp.check_('19 tamanho inexistente rejeitado', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.check_('19 tamanho inexistente rejeitado', true, SQLERRM); END;

  -- 6. Estoque insuficiente rejeitado (agregado acima do saldo).
  BEGIN
    PERFORM public.criar_pedido(jsonb_build_array(
        jsonb_build_object('slug','polo-piquet-marfim','size','M','quantity',5),
        jsonb_build_object('slug','polo-piquet-marfim','size','M','quantity',4)),
      v_cli, v_ent, v_pag, NULL, 'whatsapp', 'gate-' || replace(gen_random_uuid()::text,'-',''));
    PERFORM pg_temp.check_('20 estoque insuficiente rejeitado', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.check_('20 estoque insuficiente rejeitado', true, SQLERRM); END;

  -- 7. Entrega sem endereço completo é rejeitada.
  BEGIN
    PERFORM public.criar_pedido(jsonb_build_array(jsonb_build_object('slug','polo-piquet-marfim','size','M','quantity',1)),
      v_cli, jsonb_build_object('metodo','entrega','endereco', jsonb_build_object('cep','30130-000')),
      v_pag, NULL, 'whatsapp', 'gate-' || replace(gen_random_uuid()::text,'-',''));
    PERFORM pg_temp.check_('06 entrega sem endereço completo rejeitada', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.check_('06 entrega sem endereço completo rejeitada', true, SQLERRM); END;

  -- 8. Pagamento não permitido / canal inválido.
  BEGIN
    PERFORM public.criar_pedido(jsonb_build_array(jsonb_build_object('slug','polo-piquet-marfim','size','M','quantity',1)),
      v_cli, v_ent, jsonb_build_object('metodo','boleto'), NULL, 'whatsapp',
      'gate-' || replace(gen_random_uuid()::text,'-',''));
    PERFORM pg_temp.check_('06 forma de pagamento não permitida rejeitada', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.check_('06 forma de pagamento não permitida rejeitada', true, SQLERRM); END;

  -- 9. "Já enviei" persiste no backend e é idempotente.
  SELECT * INTO r FROM public.confirmar_whatsapp_checkout(v_id, v_key);
  PERFORM pg_temp.check_('12 Já enviei grava whatsapp_declarado_enviado_em',
    r.whatsapp_declarado_enviado_em IS NOT NULL);
  PERFORM pg_temp.check_('12 origem da confirmação registrada como cliente',
    (SELECT whatsapp_confirmacao_origem FROM public.pedidos WHERE id = v_id) = 'cliente');
  PERFORM pg_temp.check_('12 evento auditável registrado',
    EXISTS (SELECT 1 FROM public.pedido_eventos WHERE pedido_id = v_id AND tipo = 'whatsapp.declarado_enviado'));
  SELECT * INTO r2 FROM public.confirmar_whatsapp_checkout(v_id, v_key);
  PERFORM pg_temp.check_('12 confirmação é idempotente',
    r2.whatsapp_declarado_enviado_em = r.whatsapp_declarado_enviado_em
    AND (SELECT count(*) FROM public.pedido_eventos WHERE pedido_id = v_id AND tipo='whatsapp.declarado_enviado') = 1);

  -- 10. Confirmação com chave errada é negada.
  BEGIN
    PERFORM public.confirmar_whatsapp_checkout(v_id, 'gate-chave-errada-1234567890');
    PERFORM pg_temp.check_('13 confirmação com chave errada negada', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.check_('13 confirmação com chave errada negada', true, SQLERRM); END;

  -- 11. Cancelamento pelo cliente em "novo" funciona e é idempotente.
  SELECT * INTO r FROM public.cancelar_pedido_checkout(v_id, v_key);
  PERFORM pg_temp.check_('14 cancelamento em novo funciona', r.status = 'cancelado', r.status);
  SELECT * INTO r2 FROM public.cancelar_pedido_checkout(v_id, v_key);
  PERFORM pg_temp.check_('14 cancelamento é idempotente', r2.status = 'cancelado'
    AND (SELECT count(*) FROM public.pedido_eventos WHERE pedido_id = v_id AND tipo='pedido.cancelado') = 1);
END $gate$;

-- 12. Cancelamento bloqueado após o atendimento começar (separado / reservado / enviado).
DO $gate2$
DECLARE
  v_cli jsonb := jsonb_build_object('nome','Cliente Gate','telefone','31999998888');
  v_ent jsonb := jsonb_build_object('metodo','retirada','retirada',
      jsonb_build_object('date', to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1,'YYYY-MM-DD'),'time','10:00'));
  v_pag jsonb := jsonb_build_object('metodo','pix');
  st text; v_key text; r record;
BEGIN
  FOREACH st IN ARRAY ARRAY['separado','reservado','enviado'] LOOP
    v_key := 'gate-' || replace(gen_random_uuid()::text,'-','');
    SELECT * INTO r FROM public.criar_pedido(
      jsonb_build_array(jsonb_build_object('slug','polo-oliva-tipped','size','M','quantity',1)),
      v_cli, v_ent, v_pag, NULL, 'whatsapp', v_key);
    -- Simula o avanço feito pela equipe (via contexto de RPC protegida).
    PERFORM set_config('app.rpc_ctx','on', true);
    UPDATE public.pedidos SET status = 'separado', responsavel_id = gen_random_uuid(),
           atendente_nome = 'Equipe' WHERE id = r.id;
    IF st <> 'separado' THEN
      UPDATE public.pedidos SET status = CASE WHEN st='enviado' THEN 'reservado' ELSE st END WHERE id = r.id;
      IF st = 'enviado' THEN UPDATE public.pedidos SET status='enviado' WHERE id = r.id; END IF;
    END IF;
    PERFORM set_config('app.rpc_ctx','off', true);
    BEGIN
      PERFORM public.cancelar_pedido_checkout(r.id, v_key);
      PERFORM pg_temp.check_(format('15/16/17 cancelamento em %s bloqueado', st), false, 'não lançou erro');
    EXCEPTION WHEN OTHERS THEN
      PERFORM pg_temp.check_(format('15/16/17 cancelamento em %s bloqueado', st),
        SQLERRM LIKE '%atendimento deste pedido já começou%', SQLERRM);
    END;
    PERFORM pg_temp.check_(format('17 pedido em %s permanece intacto', st),
      (SELECT status FROM public.pedidos WHERE id = r.id) = st);
  END LOOP;
END $gate2$;

-- 13. UPDATE direto em pedidos é negado fora das RPCs protegidas.
DO $gate3$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.pedidos ORDER BY criado_em DESC LIMIT 1;
  BEGIN
    UPDATE public.pedidos SET status = 'separado' WHERE id = v_id;
    PERFORM pg_temp.check_('22 UPDATE direto de status negado', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('22 UPDATE direto de status negado', true, SQLERRM);
  END;
  BEGIN
    UPDATE public.pedidos SET consumo_aplicado = true WHERE id = v_id;
    PERFORM pg_temp.check_('22 UPDATE direto de consumo_aplicado negado', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('22 UPDATE direto de consumo_aplicado negado', true, SQLERRM);
  END;
  BEGIN
    UPDATE public.pedidos SET valor_total = 1 WHERE id = v_id;
    PERFORM pg_temp.check_('22 UPDATE direto de valor_total negado', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('22 UPDATE direto de valor_total negado', true, SQLERRM);
  END;
END $gate3$;

\echo '--- RESULTADO DO GATE DE BANCO ---'
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS r, nome, detalhe FROM gate_result ORDER BY nome;
SELECT count(*) FILTER (WHERE ok) AS passaram, count(*) FILTER (WHERE NOT ok) AS falharam, count(*) AS total FROM gate_result;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM gate_result WHERE NOT ok) THEN
    RAISE EXCEPTION 'GATE DE BANCO FALHOU';
  END IF;
END $$;

ROLLBACK;
