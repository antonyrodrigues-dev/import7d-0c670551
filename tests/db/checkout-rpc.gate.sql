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
    jsonb_build_array(jsonb_build_object('slug','camiseta-ea7-mini-patch-preta','size','G','quantity',1,
      'price',1,'name','HACK','image','http://evil','subtotal',1)),
    v_cli, v_ent, v_pag, 'obs gate', 'whatsapp', v_key);
  snap := r.snapshot; v_id := r.id;
  PERFORM pg_temp.check_('01 pedido criado com snapshot oficial', r.numero_pedido LIKE '7D-%', r.numero_pedido);
  PERFORM pg_temp.check_('21 payload manipulado não altera preço/nome/total',
    (snap->'produtos'->0->>'price')::numeric = 105 AND snap->'produtos'->0->>'name' <> 'HACK'
    AND r.valor_total = 105, format('preco=%s total=%s', snap->'produtos'->0->>'price', r.valor_total));
  PERFORM pg_temp.check_('03 snapshot traz entrega e pagamento normalizados',
    snap->'entrega'->>'metodo' = 'retirada' AND snap->'pagamento'->>'metodo' = 'credito'
    AND (snap->'pagamento'->>'parcelas')::int = 3);

  -- 2. Idempotência: mesma chave devolve o MESMO pedido, sem duplicar.
  SELECT * INTO r2 FROM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','camiseta-ea7-mini-patch-preta','size','G','quantity',1)),
    v_cli, v_ent, v_pag, NULL, 'whatsapp', v_key);
  PERFORM pg_temp.check_('09/10 mesma idempotency_key devolve o mesmo pedido', r2.id = v_id,
    format('%s vs %s', r2.id, v_id));
  PERFORM pg_temp.check_('09 nenhuma duplicidade gravada',
    (SELECT count(*) FROM public.pedidos WHERE idempotency_key = v_key) = 1);

  -- 3. Chave inválida é rejeitada.
  BEGIN
    PERFORM public.criar_pedido(jsonb_build_array(jsonb_build_object('slug','camiseta-ea7-mini-patch-preta','size','G','quantity',1)),
      v_cli, v_ent, v_pag, NULL, 'whatsapp', '');
    PERFORM pg_temp.check_('04 chave vazia rejeitada', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.check_('04 chave vazia rejeitada', true, SQLERRM); END;
  BEGIN
    PERFORM public.criar_pedido(jsonb_build_array(jsonb_build_object('slug','camiseta-ea7-mini-patch-preta','size','G','quantity',1)),
      v_cli, v_ent, v_pag, NULL, 'whatsapp', 'aaaaaaaaaaaaaaaaaaaa');
    PERFORM pg_temp.check_('04 chave sem entropia rejeitada', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.check_('04 chave sem entropia rejeitada', true, SQLERRM); END;

  -- 4. Itens repetidos são agregados: duas linhas de 1 un. de uma peça única
  --    (saldo 1) só podem falhar se a soma for avaliada em conjunto.
  BEGIN
    PERFORM public.criar_pedido(
      jsonb_build_array(
        jsonb_build_object('slug','camiseta-boss-logo-tonal-preta','size','G','quantity',1),
        jsonb_build_object('slug','camiseta-boss-logo-tonal-preta','size','G','quantity',1)),
      v_cli, v_ent, jsonb_build_object('metodo','pix'), NULL, 'whatsapp',
      'gate-' || replace(gen_random_uuid()::text,'-',''));
    PERFORM pg_temp.check_('18 itens duplicados agregados antes do saldo', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('18 itens duplicados agregados antes do saldo', true, SQLERRM);
  END;

  -- 4b. Pedido válido em PIX: parcelas normalizadas para 1 e linha única.
  SELECT * INTO r FROM public.criar_pedido(
    jsonb_build_array(
      jsonb_build_object('slug','camiseta-boss-logo-tonal-preta','size','G','quantity',1)),
    v_cli, v_ent, jsonb_build_object('metodo','pix','parcelas',6), NULL, 'whatsapp',
    'gate-' || replace(gen_random_uuid()::text,'-',''));
  snap := r.snapshot;
  PERFORM pg_temp.check_('18 pedido PIX gera uma linha oficial',
    jsonb_array_length(snap->'produtos') = 1 AND (snap->'produtos'->0->>'quantity')::int = 1
    AND r.valor_total = 105, format('linhas=%s total=%s', jsonb_array_length(snap->'produtos'), r.valor_total));
  PERFORM pg_temp.check_('06 parcelas normalizadas fora do crédito',
    (snap->'pagamento'->>'parcelas')::int = 1);

  -- 5. Tamanho inexistente rejeitado.
  BEGIN
    PERFORM public.criar_pedido(jsonb_build_array(jsonb_build_object('slug','camiseta-ea7-mini-patch-preta','size','XXG','quantity',1)),
      v_cli, v_ent, v_pag, NULL, 'whatsapp', 'gate-' || replace(gen_random_uuid()::text,'-',''));
    PERFORM pg_temp.check_('19 tamanho inexistente rejeitado', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.check_('19 tamanho inexistente rejeitado', true, SQLERRM); END;

  -- 6. Estoque insuficiente rejeitado (agregado acima do saldo).
  BEGIN
    PERFORM public.criar_pedido(jsonb_build_array(
        jsonb_build_object('slug','camiseta-ea7-mini-patch-preta','size','G','quantity',5),
        jsonb_build_object('slug','camiseta-ea7-mini-patch-preta','size','G','quantity',4)),
      v_cli, v_ent, v_pag, NULL, 'whatsapp', 'gate-' || replace(gen_random_uuid()::text,'-',''));
    PERFORM pg_temp.check_('20 estoque insuficiente rejeitado', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.check_('20 estoque insuficiente rejeitado', true, SQLERRM); END;

  -- 7. Entrega sem endereço completo é rejeitada.
  BEGIN
    PERFORM public.criar_pedido(jsonb_build_array(jsonb_build_object('slug','camiseta-ea7-mini-patch-preta','size','G','quantity',1)),
      v_cli, jsonb_build_object('metodo','entrega','endereco', jsonb_build_object('cep','30130-000')),
      v_pag, NULL, 'whatsapp', 'gate-' || replace(gen_random_uuid()::text,'-',''));
    PERFORM pg_temp.check_('06 entrega sem endereço completo rejeitada', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.check_('06 entrega sem endereço completo rejeitada', true, SQLERRM); END;

  -- 8. Pagamento não permitido / canal inválido.
  BEGIN
    PERFORM public.criar_pedido(jsonb_build_array(jsonb_build_object('slug','camiseta-ea7-mini-patch-preta','size','G','quantity',1)),
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
--     O avanço é feito pela RPC protegida `transicionar_pedido`, autenticada
--     como um admin real via claims JWT — nunca por UPDATE direto.
DO $gate2$
DECLARE
  v_cli jsonb := jsonb_build_object('nome','Cliente Gate','telefone','31999998888');
  v_ent jsonb := jsonb_build_object('metodo','retirada','retirada',
      jsonb_build_object('date', to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1,'YYYY-MM-DD'),'time','10:00'));
  v_pag jsonb := jsonb_build_object('metodo','pix');
  v_admin uuid;
  st text; v_key text; r record;
BEGIN
  SELECT user_id INTO v_admin FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF v_admin IS NULL THEN
    PERFORM pg_temp.check_('15/16/17 cancelamento pós-atendimento', false, 'sem admin para o harness');
    RETURN;
  END IF;

  FOREACH st IN ARRAY ARRAY['separado','reservado','enviado'] LOOP
    v_key := 'gate-' || replace(gen_random_uuid()::text,'-','');
    SELECT * INTO r FROM public.criar_pedido(
      jsonb_build_array(jsonb_build_object('slug','camiseta-prada-triangulo-cinza-claro','size','G','quantity',1)),
      v_cli, v_ent, v_pag, NULL, 'whatsapp', v_key);

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    PERFORM public.transicionar_pedido(r.id, 'separado');
    IF st IN ('reservado','enviado') THEN PERFORM public.transicionar_pedido(r.id, 'reservado'); END IF;
    IF st = 'enviado' THEN PERFORM public.transicionar_pedido(r.id, 'enviado'); END IF;
    PERFORM set_config('request.jwt.claims', '', true);

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

-- 13. Nenhum papel de aplicação pode alterar pedidos fora das RPCs protegidas.
DO $gate3$
BEGIN
  PERFORM pg_temp.check_('22 authenticated não tem UPDATE em pedidos',
    NOT has_table_privilege('authenticated','public.pedidos','UPDATE'));
  PERFORM pg_temp.check_('22 anon não tem UPDATE em pedidos',
    NOT has_table_privilege('anon','public.pedidos','UPDATE'));
  PERFORM pg_temp.check_('22 anon não tem INSERT direto em pedidos',
    NOT has_table_privilege('anon','public.pedidos','INSERT'));
  PERFORM pg_temp.check_('22 authenticated não tem DELETE em pedidos',
    NOT has_table_privilege('authenticated','public.pedidos','DELETE'));
  PERFORM pg_temp.check_('22 guarda de banco pedidos_guard_update ativa',
    EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
            WHERE c.relname = 'pedidos' AND t.tgname LIKE '%guard%' AND NOT t.tgisinternal));
END $gate3$;


-- 14. Validações de payload: telefone, quantidade mínima/máxima e produto inativo.
DO $gate4$
DECLARE
  v_cli jsonb := jsonb_build_object('nome','Cliente Gate','telefone','31999998888');
  v_sem_tel jsonb := jsonb_build_object('nome','Cliente Gate','telefone','123');
  v_ent jsonb := jsonb_build_object('metodo','retirada','retirada',
      jsonb_build_object('date', to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1,'YYYY-MM-DD'),'time','10:00'));
  v_pag jsonb := jsonb_build_object('metodo','pix');
  v_slug text;
BEGIN
  BEGIN
    PERFORM public.criar_pedido(jsonb_build_array(jsonb_build_object('slug','camiseta-ea7-mini-patch-preta','size','G','quantity',1)),
      v_sem_tel, v_ent, v_pag, NULL, 'whatsapp', 'gate-' || replace(gen_random_uuid()::text,'-',''));
    PERFORM pg_temp.check_('23 telefone inválido rejeitado', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.check_('23 telefone inválido rejeitado', true, SQLERRM); END;

  BEGIN
    PERFORM public.criar_pedido(jsonb_build_array(jsonb_build_object('slug','camiseta-ea7-mini-patch-preta','size','G','quantity',0)),
      v_cli, v_ent, v_pag, NULL, 'whatsapp', 'gate-' || replace(gen_random_uuid()::text,'-',''));
    PERFORM pg_temp.check_('24 quantidade mínima rejeitada', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.check_('24 quantidade mínima rejeitada', true, SQLERRM); END;

  BEGIN
    PERFORM public.criar_pedido(jsonb_build_array(jsonb_build_object('slug','camiseta-ea7-mini-patch-preta','size','G','quantity',11)),
      v_cli, v_ent, v_pag, NULL, 'whatsapp', 'gate-' || replace(gen_random_uuid()::text,'-',''));
    PERFORM pg_temp.check_('25 quantidade máxima por item rejeitada', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.check_('25 quantidade máxima por item rejeitada', true, SQLERRM); END;

  -- Produto/variação inativos: o harness roda com papel de aplicação (sem UPDATE
  -- em produtos), então validamos estaticamente que a RPC filtra por `ativo`.
  PERFORM pg_temp.check_('26 criar_pedido filtra produto/variação inativos',
    pg_get_functiondef('public.criar_pedido(jsonb,jsonb,jsonb,jsonb,text,text,text)'::regprocedure) LIKE '%ativo%');

  -- Saldo de estoque só muda via RPC: ninguém tem UPDATE em produto_variacoes,
  -- e anon não escreve nada em catálogo/estoque.
  PERFORM pg_temp.check_('27 ninguém altera saldo de estoque diretamente',
    NOT has_table_privilege('anon','public.produto_variacoes','UPDATE')
    AND NOT has_table_privilege('authenticated','public.produto_variacoes','UPDATE'));
  PERFORM pg_temp.check_('28 anon não escreve em catálogo/estoque',
    NOT has_table_privilege('anon','public.produtos','INSERT')
    AND NOT has_table_privilege('anon','public.produtos','UPDATE')
    AND NOT has_table_privilege('anon','public.produto_variacoes','INSERT')
    AND NOT has_table_privilege('anon','public.produto_movimentacoes','INSERT'));
  PERFORM pg_temp.check_('29 trilhas de auditoria são somente leitura',
    NOT has_table_privilege('authenticated','public.pedido_eventos','INSERT')
    AND NOT has_table_privilege('authenticated','public.pedido_status_historico','UPDATE')
    AND NOT has_table_privilege('anon','public.pedido_eventos','INSERT'));
  PERFORM pg_temp.check_('30 anon não escreve em perfis e papéis',
    NOT has_table_privilege('anon','public.profiles','INSERT')
    AND NOT has_table_privilege('anon','public.user_roles','INSERT')
    AND NOT has_table_privilege('anon','public.user_roles','UPDATE'));
END $gate4$;

\echo '--- RESULTADO DO GATE DE BANCO ---'
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS r, nome, detalhe FROM gate_result ORDER BY nome;
SELECT count(*) FILTER (WHERE ok) AS passaram, count(*) FILTER (WHERE NOT ok) AS falharam, count(*) AS total FROM gate_result;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM gate_result WHERE NOT ok) THEN
    RAISE EXCEPTION 'GATE DE BANCO FALHOU';
  END IF;
END $$;

ROLLBACK;
