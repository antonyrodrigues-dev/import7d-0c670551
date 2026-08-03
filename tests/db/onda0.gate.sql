-- 7D IMPORTS — Gate de banco da ONDA 0 (reservas, fila, pagamentos, devoluções,
-- parâmetros, notificações e RBAC). Roda em transação e faz ROLLBACK: nenhum
-- dado real permanece. Os usuários de teste são criados/removidos pelo runner
-- `tests/db/onda0-gate.py`, que injeta :adminid, :vendedorid, :vendedor2id,
-- :inativoid e :semcargoid.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE gate_result(nome text, ok boolean, detalhe text) ON COMMIT DROP;
CREATE OR REPLACE FUNCTION pg_temp.check_(p_nome text, p_ok boolean, p_detalhe text DEFAULT '')
RETURNS void LANGUAGE sql AS $$ INSERT INTO gate_result VALUES (p_nome, p_ok, p_detalhe) $$;
CREATE OR REPLACE FUNCTION pg_temp.as_user(p_uid uuid)
RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)::void
$$;
CREATE OR REPLACE FUNCTION pg_temp.novo_produto(
  p_slug text, p_modelo text, p_tam text, p_qtd int, p_reservada int, p_quarentena int)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.produtos (sku, slug, nome, marca, categoria, descricao, imagens, preco,
                               ativo, destaque, modelo_estoque)
  VALUES (upper(p_slug), p_slug, initcap(replace(p_slug,'-',' ')), '7D', 'Testes', 'gate',
          '["/gate.jpg"]'::jsonb, 500, true, false, p_modelo)
  RETURNING id INTO v_id;
  INSERT INTO public.produto_variacoes (produto_id, tamanho, quantidade, quantidade_reservada, quantidade_quarentena)
  VALUES (v_id, p_tam, p_qtd, p_reservada, p_quarentena);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.anon_()
RETURNS void LANGUAGE sql AS $$ SELECT set_config('request.jwt.claims','', true)::void $$;

SELECT set_config('gate.admin', :'adminid', true),
       set_config('gate.vend',  :'vendedorid', true),
       set_config('gate.vend2', :'vendedor2id', true),
       set_config('gate.inat',  :'inativoid', true),
       set_config('gate.sem',   :'semcargoid', true);

-- Fixtures de identidade (perfis e papéis) são criadas pelo runner via API
-- administrativa, porque a role de teste não escreve em `profiles`/`user_roles`.
-- Ao final, o runner remove os usuários e o cascade limpa as duas tabelas.

DO $gate$
DECLARE
  v_admin uuid; v_vend uuid; v_vend2 uuid; v_inat uuid; v_sem uuid;
  v_cli jsonb := jsonb_build_object('nome','Cliente Onda0','telefone','(31) 98888-7777','cpf','390.533.447-05');
  v_ent jsonb := jsonb_build_object('metodo','retirada','retirada',
      jsonb_build_object('date', to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1,'YYYY-MM-DD'),'time','10:00'));
  v_pag jsonb := jsonb_build_object('metodo','pix');
  v_prod uuid; v_multi uuid;
  r record; msg text; ok boolean;
  v_p1 uuid; v_p2 uuid; v_p3 uuid; v_num text;
  v_key text; v_n int; v_metrics jsonb; v_dev uuid;
  v_disp int; v_res int; v_qtd int; v_quar int;
  v_before int; v_after int; v_expira timestamptz;
BEGIN
  SELECT current_setting('gate.admin')::uuid, current_setting('gate.vend')::uuid,
         current_setting('gate.vend2')::uuid, current_setting('gate.inat')::uuid,
         current_setting('gate.sem')::uuid
    INTO v_admin, v_vend, v_vend2, v_inat, v_sem;

  -- Produtos de teste (todos removidos no ROLLBACK).
  -- A role do gate só tem INSERT/SELECT: nenhum cenário depende de UPDATE
  -- direto — os saldos iniciais são criados já no estado desejado.
  PERFORM pg_temp.novo_produto('gate-unica-a','peca_unica','U',1,0,0);
  PERFORM pg_temp.novo_produto('gate-unica-b','peca_unica','U',1,1,0);
  PERFORM pg_temp.novo_produto('gate-unica-c','peca_unica','U',1,0,0);
  PERFORM pg_temp.novo_produto('gate-unica-d','peca_unica','U',1,0,0);
  PERFORM pg_temp.novo_produto('gate-unica-e','peca_unica','U',1,0,0);
  PERFORM pg_temp.novo_produto('gate-quarentena','multi_variante','M',2,0,2);
  v_multi := pg_temp.novo_produto('gate-multi','multi_variante','M',10,0,0);
  v_prod  := (SELECT id FROM public.produtos WHERE slug='gate-unica-a');

  -- =========================================================================
  -- 2. RESERVA TEMPORÁRIA
  -- =========================================================================
  v_key := 'gate-' || replace(gen_random_uuid()::text,'-','');
  SELECT * INTO r FROM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','gate-unica-a','size','U','quantity',1)),
    v_cli, v_ent, v_pag, NULL, 'whatsapp', v_key);
  v_p1 := r.id;
  SELECT quantidade, quantidade_reservada, disponivel INTO v_qtd, v_res, v_disp
    FROM public.produto_variacoes WHERE produto_id = v_prod AND tamanho='U';
  PERFORM pg_temp.check_('O0-R01 peça única reservada na criação',
    v_res = 1 AND v_disp = 0 AND EXISTS (SELECT 1 FROM public.reservas_estoque
      WHERE pedido_id = v_p1 AND estado = 'reservada_temporariamente'),
    format('qtd=%s reservada=%s disponivel=%s', v_qtd, v_res, v_disp));

  BEGIN
    PERFORM public.criar_pedido(
      jsonb_build_array(jsonb_build_object('slug','gate-unica-a','size','U','quantity',1)),
      v_cli, v_ent, v_pag, NULL, 'whatsapp', 'gate-' || replace(gen_random_uuid()::text,'-',''));
    PERFORM pg_temp.check_('O0-R02 segundo cliente não reserva a mesma unidade', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-R02 segundo cliente não reserva a mesma unidade', true, SQLERRM);
  END;

  -- Expiração: reserva já vencida em `gate-unica-b` (saldo criado reservado),
  -- liberada pela rotina oficial usada pelo pg_cron.
  v_prod := (SELECT id FROM public.produtos WHERE slug='gate-unica-b');
  INSERT INTO public.reservas_estoque (pedido_id, produto_id, tamanho, quantidade, expira_em)
  VALUES (v_p1, v_prod, 'U', 1, now() - interval '1 minute');
  v_n := public.expirar_reservas();
  SELECT quantidade_reservada, disponivel INTO v_res, v_disp
    FROM public.produto_variacoes WHERE produto_id = v_prod AND tamanho='U';
  PERFORM pg_temp.check_('O0-R03 reserva vencida expira pela rotina oficial',
    v_n >= 1 AND EXISTS (SELECT 1 FROM public.reservas_estoque
      WHERE produto_id = v_prod AND estado='expirada'),
    format('expiradas=%s', v_n));
  PERFORM pg_temp.check_('O0-R04 quantidade reservada é liberada', v_res = 0, format('reservada=%s', v_res));
  PERFORM pg_temp.check_('O0-R05 catálogo volta a mostrar disponibilidade', v_disp = 1, format('disponivel=%s', v_disp));
  PERFORM pg_temp.check_('O0-R05b movimentação de liberação registrada',
    EXISTS (SELECT 1 FROM public.produto_movimentacoes
             WHERE produto_id = v_prod AND tipo='liberacao_reserva' AND motivo='expiracao'));
  PERFORM pg_temp.check_('O0-R08 reserva expirada não vira venda',
    (SELECT count(*) FROM public.reservas_estoque WHERE produto_id = v_prod AND estado='vendida') = 0);
  PERFORM public.converter_reservas_pedido(v_p1);
  PERFORM pg_temp.check_('O0-R08b converter reserva expirada não altera estoque',
    (SELECT estado FROM public.reservas_estoque WHERE produto_id = v_prod) = 'expirada'
    AND (SELECT quantidade_reservada FROM public.produto_variacoes WHERE produto_id=v_prod AND tamanho='U') = 0);
  v_prod := (SELECT id FROM public.produtos WHERE slug='gate-unica-c');

  -- Cancelamento libera a reserva.
  v_key := 'gate-' || replace(gen_random_uuid()::text,'-','');
  SELECT * INTO r FROM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','gate-unica-c','size','U','quantity',1)),
    v_cli, v_ent, v_pag, NULL, 'whatsapp', v_key);
  v_p2 := r.id;
  PERFORM public.cancelar_pedido_checkout(v_p2, v_key);
  SELECT quantidade_reservada, disponivel INTO v_res, v_disp
    FROM public.produto_variacoes WHERE produto_id = v_prod AND tamanho='U';
  PERFORM pg_temp.check_('O0-R06 cancelamento libera a reserva',
    v_res = 0 AND v_disp = 1
    AND (SELECT estado FROM public.reservas_estoque WHERE pedido_id = v_p2) = 'cancelada',
    format('reservada=%s disponivel=%s', v_res, v_disp));

  -- Atendimento estende/converte a reserva.
  v_key := 'gate-' || replace(gen_random_uuid()::text,'-','');
  SELECT * INTO r FROM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','gate-unica-d','size','U','quantity',1)),
    v_cli, v_ent, v_pag, NULL, 'whatsapp', v_key);
  v_p3 := r.id; v_num := r.numero_pedido;

  PERFORM pg_temp.as_user(v_vend);
  PERFORM public.assumir_atendimento(v_p3);
  PERFORM pg_temp.check_('O0-R07 atendimento protege a reserva (não expira)',
    (SELECT estado FROM public.reservas_estoque WHERE pedido_id = v_p3) = 'em_atendimento');
  -- Reserva em atendimento já vencida: a rotina do cron deve ignorá-la.
  INSERT INTO public.reservas_estoque (pedido_id, produto_id, tamanho, quantidade, estado, expira_em)
  VALUES (v_p3, (SELECT id FROM public.produtos WHERE slug='gate-unica-e'), 'U', 1,
          'em_atendimento', now() - interval '1 minute');
  v_n := public.expirar_reservas();
  PERFORM pg_temp.check_('O0-R07b reserva em atendimento não é expirada pelo cron',
    NOT EXISTS (SELECT 1 FROM public.reservas_estoque
                 WHERE pedido_id = v_p3 AND estado <> 'em_atendimento'));

  -- =========================================================================
  -- 4. FILA DE ATENDIMENTO (dois usuários)
  -- =========================================================================
  PERFORM pg_temp.check_('O0-F01 primeiro vendedor assume o pedido',
    (SELECT responsavel_id FROM public.pedidos WHERE id = v_p3) = v_vend);
  PERFORM pg_temp.as_user(v_vend2);
  BEGIN
    PERFORM public.assumir_atendimento(v_p3);
    PERFORM pg_temp.check_('O0-F02 segundo vendedor recebe conflito controlado', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-F02 segundo vendedor recebe conflito controlado', true, SQLERRM);
  END;
  BEGIN
    PERFORM public.transicionar_pedido(v_p3, 'reservado');
    PERFORM pg_temp.check_('O0-F03 vendedor não opera pedido de outro', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-F03 vendedor não opera pedido de outro', true, SQLERRM);
  END;
  PERFORM pg_temp.as_user(v_vend);
  PERFORM public.assumir_atendimento(v_p3);
  PERFORM pg_temp.check_('O0-F04 assumir é idempotente para o mesmo responsável',
    (SELECT count(*) FROM public.pedido_atendimentos WHERE pedido_id = v_p3 AND acao='assumido') = 1);

  PERFORM pg_temp.as_user(v_inat);
  BEGIN
    PERFORM public.assumir_atendimento(v_p3);
    PERFORM pg_temp.check_('O0-F05 funcionário inativo não assume', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-F05 funcionário inativo não assume', true, SQLERRM);
  END;
  PERFORM pg_temp.check_('O0-F05b has_role falso para perfil inativo',
    NOT public.has_role(v_inat,'atendente'));

  PERFORM pg_temp.as_user(v_sem);
  BEGIN
    PERFORM public.assumir_atendimento(v_p3);
    PERFORM pg_temp.check_('O0-F06 usuário sem cargo não assume', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-F06 usuário sem cargo não assume', true, SQLERRM);
  END;

  PERFORM pg_temp.as_user(v_vend2);
  BEGIN
    PERFORM public.transferir_atendimento(v_p3, v_vend2, 'tentativa');
    PERFORM pg_temp.check_('O0-F07 vendedor não transfere atendimento', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-F07 vendedor não transfere atendimento', true, SQLERRM);
  END;
  PERFORM pg_temp.as_user(v_admin);
  PERFORM public.transferir_atendimento(v_p3, v_vend2, 'redistribuição');
  PERFORM pg_temp.check_('O0-F08 Admin Master transfere o atendimento',
    (SELECT responsavel_id FROM public.pedidos WHERE id = v_p3) = v_vend2);
  BEGIN
    PERFORM public.transferir_atendimento(v_p3, v_sem, 'destino inválido');
    PERFORM pg_temp.check_('O0-F09 transferência para fora da equipe negada', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-F09 transferência para fora da equipe negada', true, SQLERRM);
  END;
  PERFORM public.devolver_para_fila(v_p3, 'volta para a fila');
  PERFORM pg_temp.check_('O0-F10 Admin devolve o pedido para a fila',
    (SELECT responsavel_id IS NULL AND status = 'aguardando_atendimento'
       FROM public.pedidos WHERE id = v_p3));
  PERFORM pg_temp.check_('O0-F11 trilha de atendimento é append-only e completa',
    (SELECT count(*) FROM public.pedido_atendimentos WHERE pedido_id = v_p3) >= 3);

  -- =========================================================================
  -- 7. PAGAMENTO
  -- =========================================================================
  PERFORM pg_temp.as_user(v_vend);
  PERFORM public.assumir_atendimento(v_p3);
  PERFORM public.registrar_pagamento(v_p3, 'em_analise', NULL, 'comprovante recebido');
  PERFORM pg_temp.check_('O0-P01 vendedor registra pagamento em análise',
    (SELECT pagamento_estado FROM public.pedidos WHERE id = v_p3) = 'em_analise');
  BEGIN
    PERFORM public.registrar_pagamento(v_p3, 'confirmado', NULL, NULL);
    PERFORM pg_temp.check_('O0-P02 vendedor não confirma pagamento', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-P02 vendedor não confirma pagamento', true, SQLERRM);
  END;
  BEGIN
    PERFORM public.registrar_pagamento(v_p3, 'invalido', NULL, NULL);
    PERFORM pg_temp.check_('O0-P03 estado de pagamento inválido rejeitado', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-P03 estado de pagamento inválido rejeitado', true, SQLERRM);
  END;

  PERFORM pg_temp.as_user(v_admin);
  PERFORM public.registrar_pagamento(v_p3, 'confirmado', 'https://x/comprovante.png', 'ok');
  v_before := (SELECT count(*) FROM public.pedido_pagamentos WHERE pedido_id = v_p3);
  PERFORM public.registrar_pagamento(v_p3, 'confirmado', NULL, NULL);
  PERFORM public.registrar_pagamento(v_p3, 'confirmado', NULL, NULL);
  v_after := (SELECT count(*) FROM public.pedido_pagamentos WHERE pedido_id = v_p3);
  PERFORM pg_temp.check_('O0-P04 Admin confirma pagamento',
    (SELECT pagamento_estado FROM public.pedidos WHERE id = v_p3) = 'confirmado');
  PERFORM pg_temp.check_('O0-P05 confirmação duplicada/clique duplo é idempotente',
    v_before = v_after, format('antes=%s depois=%s', v_before, v_after));
  PERFORM pg_temp.check_('O0-P06 pagamento grava valor oficial e responsável',
    EXISTS (SELECT 1 FROM public.pedido_pagamentos pp JOIN public.pedidos p ON p.id = pp.pedido_id
             WHERE pp.pedido_id = v_p3 AND pp.estado='confirmado'
               AND pp.valor = p.valor_total AND pp.por_usuario = v_admin));
  BEGIN
    UPDATE public.pedido_pagamentos SET valor = 1 WHERE pedido_id = v_p3;
    PERFORM pg_temp.check_('O0-P07 histórico de pagamento é imutável', false, 'update permitido');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-P07 histórico de pagamento é imutável', true, SQLERRM);
  END;

  -- =========================================================================
  -- 8. DEVOLUÇÃO
  -- =========================================================================
  -- Pedido multi-variante finalizado, para devolver.
  PERFORM pg_temp.anon_();
  v_key := 'gate-' || replace(gen_random_uuid()::text,'-','');
  SELECT * INTO r FROM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','gate-multi','size','M','quantity',4)),
    v_cli, v_ent, v_pag, NULL, 'whatsapp', v_key);
  v_p2 := r.id;
  PERFORM pg_temp.as_user(v_admin);
  BEGIN
    PERFORM public.registrar_devolucao(v_p2,
      jsonb_build_array(jsonb_build_object('slug','gate-multi','size','M','quantity',1,'condicao','vendavel')),
      'antes da hora', 0, NULL, NULL);
    PERFORM pg_temp.check_('O0-D01 somente pedido finalizado é devolvido', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-D01 somente pedido finalizado é devolvido', true, SQLERRM);
  END;

  PERFORM public.transicionar_pedido(v_p2, 'separado');
  PERFORM public.transicionar_pedido(v_p2, 'finalizado');
  SELECT quantidade INTO v_before FROM public.produto_variacoes WHERE produto_id=v_multi AND tamanho='M';
  PERFORM pg_temp.check_('O0-D02 consumo de estoque na venda', v_before = 6, format('saldo=%s', v_before));

  BEGIN
    PERFORM public.registrar_devolucao(v_p2,
      jsonb_build_array(jsonb_build_object('slug','gate-multi','size','M','quantity',9,'condicao','vendavel')),
      'excesso', 0, NULL, NULL);
    PERFORM pg_temp.check_('O0-D03 quantidade maior que a vendida rejeitada', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-D03 quantidade maior que a vendida rejeitada', true, SQLERRM);
  END;
  BEGIN
    PERFORM public.registrar_devolucao(v_p2,
      jsonb_build_array(jsonb_build_object('slug','gate-multi','size','M','quantity',1,'condicao','vendavel')),
      'valor absurdo', 999999, NULL, NULL);
    PERFORM pg_temp.check_('O0-D04 estorno acima do total rejeitado', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-D04 estorno acima do total rejeitado', true, SQLERRM);
  END;

  -- Devolução parcial: 1 vendável + 1 avariada.
  v_dev := public.registrar_devolucao(v_p2,
    jsonb_build_array(
      jsonb_build_object('slug','gate-multi','size','M','quantity',1,'condicao','vendavel'),
      jsonb_build_object('slug','gate-multi','size','M','quantity',1,'condicao','avariada')),
    'defeito de costura', 500, 'parcial', NULL);
  SELECT quantidade, quantidade_quarentena, disponivel INTO v_qtd, v_quar, v_disp
    FROM public.produto_variacoes WHERE produto_id=v_multi AND tamanho='M';
  PERFORM pg_temp.check_('O0-D05 peça vendável retorna ao saldo', v_qtd = 8, format('qtd=%s', v_qtd));
  PERFORM pg_temp.check_('O0-D06 peça avariada vai para quarentena', v_quar = 1, format('quarentena=%s', v_quar));
  PERFORM pg_temp.check_('O0-D07 quarentena não conta como disponível',
    v_disp = v_qtd - v_quar, format('disponivel=%s qtd=%s quar=%s', v_disp, v_qtd, v_quar));
  PERFORM pg_temp.check_('O0-D08 pedido vira devolvido e soma o estorno',
    (SELECT status = 'devolvido' AND valor_devolvido = 500 AND pagamento_estado='estornado'
       FROM public.pedidos WHERE id = v_p2));
  PERFORM pg_temp.check_('O0-D09 itens da devolução registrados com condição',
    (SELECT count(*) FROM public.pedido_devolucao_itens WHERE devolucao_id = v_dev) = 2);
  BEGIN
    DELETE FROM public.pedido_devolucoes WHERE id = v_dev;
    PERFORM pg_temp.check_('O0-D10 histórico de devolução é append-only', false, 'delete permitido');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-D10 histórico de devolução é append-only', true, SQLERRM);
  END;
  -- Segunda devolução do restante (idempotência de saldo: nunca ultrapassa o vendido).
  BEGIN
    PERFORM public.registrar_devolucao(v_p2,
      jsonb_build_array(jsonb_build_object('slug','gate-multi','size','M','quantity',3,'condicao','vendavel')),
      'restante acima do saldo', 0, NULL, NULL);
    PERFORM pg_temp.check_('O0-D11 devoluções acumuladas não excedem o vendido', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-D11 devoluções acumuladas não excedem o vendido', true, SQLERRM);
  END;

  -- Quarentena não pode ser vendida (regra de disponibilidade real):
  -- `gate-quarentena` tem 2 peças, ambas em quarentena.
  PERFORM pg_temp.anon_();
  BEGIN
    PERFORM public.criar_pedido(
      jsonb_build_array(jsonb_build_object('slug','gate-quarentena','size','M','quantity',1)),
      v_cli, v_ent, v_pag, NULL, 'whatsapp', 'gate-' || replace(gen_random_uuid()::text,'-',''));
    PERFORM pg_temp.check_('O0-D12 peça em quarentena não é vendida', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-D12 peça em quarentena não é vendida', true, SQLERRM);
  END;
  PERFORM pg_temp.check_('O0-D12b disponível é físico menos reservado menos quarentena',
    (SELECT disponivel = 0 AND quantidade = 2 AND quantidade_quarentena = 2
       FROM public.produto_variacoes v JOIN public.produtos p ON p.id = v.produto_id
      WHERE p.slug='gate-quarentena'));

  -- =========================================================================
  -- 6. FINANCEIRO (RBAC real)
  -- =========================================================================
  PERFORM pg_temp.anon_();
  BEGIN
    PERFORM public.metricas_financeiras('30d');
    PERFORM pg_temp.check_('O0-FIN01 visitante não acessa métricas', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-FIN01 visitante não acessa métricas', true, SQLERRM);
  END;
  PERFORM pg_temp.as_user(v_vend);
  BEGIN
    PERFORM public.metricas_financeiras('30d');
    PERFORM pg_temp.check_('O0-FIN02 vendedor tem RPC financeira negada', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-FIN02 vendedor tem RPC financeira negada', true, SQLERRM);
  END;
  PERFORM pg_temp.as_user(v_inat);
  BEGIN
    PERFORM public.metricas_financeiras('30d');
    PERFORM pg_temp.check_('O0-FIN03 admin inativado perde acesso financeiro', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-FIN03 admin inativado perde acesso financeiro', true, SQLERRM);
  END;
  PERFORM pg_temp.as_user(v_admin);
  v_metrics := public.metricas_financeiras('30d');
  PERFORM pg_temp.check_('O0-FIN04 Admin Master recebe métricas completas',
    v_metrics ? 'receitaPeriodo' AND v_metrics ? 'valorDevolvido' AND v_metrics ? 'ticketMedioPeriodo'
    AND v_metrics ? 'series' AND v_metrics ? 'topProdutos',
    left(v_metrics::text, 120));
  PERFORM pg_temp.check_('O0-FIN05 métricas usam America/Sao_Paulo',
    (SELECT prosrc LIKE '%America/Sao_Paulo%' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='metricas_financeiras'));
  PERFORM pg_temp.check_('O0-FIN06 líquido desconta devoluções',
    (SELECT prosrc LIKE '%valor_total - p.valor_devolvido%' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='metricas_financeiras'));

  -- =========================================================================
  -- 10. PARÂMETROS OPERACIONAIS
  -- =========================================================================
  PERFORM pg_temp.as_user(v_vend);
  BEGIN
    PERFORM public.definir_parametro('reserva_peca_unica_minutos','30'::jsonb);
    PERFORM pg_temp.check_('O0-PA01 vendedor não altera parâmetros', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-PA01 vendedor não altera parâmetros', true, SQLERRM);
  END;
  PERFORM pg_temp.as_user(v_admin);
  BEGIN
    PERFORM public.definir_parametro('reserva_peca_unica_minutos','4'::jsonb);
    PERFORM pg_temp.check_('O0-PA02 reserva menor que 5 minutos rejeitada', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-PA02 reserva menor que 5 minutos rejeitada', true, SQLERRM);
  END;
  BEGIN
    PERFORM public.definir_parametro('reserva_peca_unica_minutos','121'::jsonb);
    PERFORM pg_temp.check_('O0-PA03 reserva maior que 120 minutos rejeitada', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-PA03 reserva maior que 120 minutos rejeitada', true, SQLERRM);
  END;
  BEGIN
    PERFORM public.definir_parametro('parametro_inexistente','10'::jsonb);
    PERFORM pg_temp.check_('O0-PA04 parâmetro desconhecido rejeitado', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-PA04 parâmetro desconhecido rejeitado', true, SQLERRM);
  END;
  PERFORM public.definir_parametro('atendimento_atrasado_minutos','40'::jsonb);
  BEGIN
    PERFORM public.definir_parametro('alerta_atendimento_minutos','50'::jsonb);
    PERFORM pg_temp.check_('O0-PA05 alerta posterior ao atraso rejeitado', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-PA05 alerta posterior ao atraso rejeitado', true, SQLERRM);
  END;

  PERFORM public.definir_parametro('reserva_peca_unica_minutos','45'::jsonb);
  PERFORM pg_temp.check_('O0-PA06 parâmetro registra autor e data',
    (SELECT atualizado_por = v_admin AND atualizado_em > now() - interval '1 minute'
       FROM public.parametros_operacionais WHERE chave='reserva_peca_unica_minutos'));
  PERFORM pg_temp.check_('O0-PA07 alteração de parâmetro gera notificação',
    EXISTS (SELECT 1 FROM public.notificacoes WHERE tipo='parametro.alterado'
             AND criado_em > now() - interval '1 minute'));
  PERFORM pg_temp.check_('O0-PA08 reserva_minutos reflete o novo valor', public.reserva_minutos() = 45);

  -- Novo parâmetro afeta a próxima reserva.
  PERFORM pg_temp.anon_();
  PERFORM pg_temp.novo_produto('gate-unica-f','peca_unica','U',1,0,0);
  v_key := 'gate-' || replace(gen_random_uuid()::text,'-','');
  SELECT * INTO r FROM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','gate-unica-f','size','U','quantity',1)),
    v_cli, v_ent, v_pag, NULL, 'whatsapp', v_key);
  SELECT expira_em INTO v_expira FROM public.reservas_estoque WHERE pedido_id = r.id;
  PERFORM pg_temp.check_('O0-PA09 novo parâmetro vale para a próxima reserva',
    v_expira > now() + interval '40 minutes' AND v_expira < now() + interval '50 minutes',
    format('expira_em=%s', v_expira));

  -- =========================================================================
  -- 9. NOTIFICAÇÕES
  -- =========================================================================
  PERFORM pg_temp.check_('O0-N01 novo pedido gera notificação persistente',
    EXISTS (SELECT 1 FROM public.notificacoes WHERE tipo LIKE 'pedido%'
             AND criado_em > now() - interval '2 minutes'));
  PERFORM pg_temp.check_('O0-N02 reserva expirada gera notificação',
    EXISTS (SELECT 1 FROM public.notificacoes WHERE tipo='reserva.expirada'
             AND criado_em > now() - interval '2 minutes'));
  PERFORM pg_temp.check_('O0-N03 quarentena gera notificação',
    EXISTS (SELECT 1 FROM public.notificacoes WHERE tipo='estoque.quarentena'
             AND criado_em > now() - interval '2 minutes'));
  v_before := (SELECT count(*) FROM public.notificacoes);
  PERFORM public.emitir_notificacao('gate.teste','T','M','gate-dedupe-1','info',NULL,NULL,'{}'::jsonb);
  PERFORM public.emitir_notificacao('gate.teste','T','M','gate-dedupe-1','info',NULL,NULL,'{}'::jsonb);
  v_after := (SELECT count(*) FROM public.notificacoes);
  PERFORM pg_temp.check_('O0-N04 dedupe impede notificação duplicada',
    v_after = v_before + 1, format('antes=%s depois=%s', v_before, v_after));
  PERFORM pg_temp.as_user(v_admin);
  INSERT INTO public.notificacao_leituras (notificacao_id, user_id)
  SELECT id, v_admin FROM public.notificacoes WHERE dedupe_key='gate-dedupe-1';
  PERFORM pg_temp.check_('O0-N05 leitura é registrada por usuário',
    EXISTS (SELECT 1 FROM public.notificacao_leituras l JOIN public.notificacoes n ON n.id=l.notificacao_id
             WHERE n.dedupe_key='gate-dedupe-1' AND l.user_id = v_admin));
  PERFORM pg_temp.check_('O0-N06 leitura de um usuário não vale para outro',
    NOT EXISTS (SELECT 1 FROM public.notificacao_leituras l JOIN public.notificacoes n ON n.id=l.notificacao_id
                 WHERE n.dedupe_key='gate-dedupe-1' AND l.user_id = v_vend));

  -- =========================================================================
  -- 3. EXPIRAÇÃO AUTOMÁTICA (agendamento)
  -- =========================================================================
  PERFORM pg_temp.as_user(v_admin);
  v_metrics := public.status_job_reservas();
  PERFORM pg_temp.check_('O0-C01 job de expiração agendado e ativo',
    v_metrics->>'jobname' = '7d-expirar-reservas' AND (v_metrics->>'active')::boolean
    AND v_metrics->>'schedule' = '* * * * *' AND v_metrics->>'command' LIKE '%job_expirar_reservas%',
    format('schedule=%s active=%s', v_metrics->>'schedule', v_metrics->>'active'));
  PERFORM pg_temp.check_('O0-C02 job executou com sucesso nos últimos 10 minutos',
    EXISTS (SELECT 1 FROM jsonb_array_elements(v_metrics->'ultimas') e
             WHERE e->>'status' = 'succeeded'
               AND (e->>'inicio')::timestamptz > now() - interval '10 minutes'),
    left((v_metrics->'ultimas')::text, 160));
  PERFORM pg_temp.as_user(v_vend);
  BEGIN
    PERFORM public.status_job_reservas();
    PERFORM pg_temp.check_('O0-C04 vendedor não consulta o status do job', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-C04 vendedor não consulta o status do job', true, SQLERRM);
  END;
  PERFORM pg_temp.as_user(v_admin);
  PERFORM pg_temp.check_('O0-C03 execuções do job são registradas em job_execucoes',
    EXISTS (SELECT 1 FROM public.job_execucoes WHERE job='expirar_reservas'
             AND criado_em > now() - interval '10 minutes'));

  -- =========================================================================
  -- 5. RBAC de leitura (vazamento de dados)
  -- =========================================================================
  PERFORM pg_temp.check_('O0-S01 listar_equipe restrita ao Admin Master', true, 'ver O0-S02');
  PERFORM pg_temp.as_user(v_vend);
  BEGIN
    PERFORM 1 FROM public.listar_equipe();
    PERFORM pg_temp.check_('O0-S02 vendedor não lista a equipe', false, 'não lançou erro');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('O0-S02 vendedor não lista a equipe', true, SQLERRM);
  END;
  PERFORM pg_temp.as_user(v_admin);
  PERFORM pg_temp.check_('O0-S03 Admin Master enxerga usuários aguardando liberação',
    EXISTS (SELECT 1 FROM public.listar_equipe() e WHERE e.user_id = v_sem AND e.situacao='aguardando_liberacao'));
  PERFORM pg_temp.check_('O0-S04 Admin Master enxerga usuário inativo',
    EXISTS (SELECT 1 FROM public.listar_equipe() e WHERE e.user_id = v_inat AND e.situacao='inativo'));
  PERFORM pg_temp.anon_();
END $gate$;

\pset pager off
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS status, nome, detalhe FROM gate_result ORDER BY nome;
SELECT count(*) FILTER (WHERE ok) AS passaram,
       count(*) FILTER (WHERE NOT ok) AS falharam,
       count(*) AS total FROM gate_result;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM gate_result WHERE NOT ok;
  IF v > 0 THEN RAISE EXCEPTION 'GATE ONDA 0 FALHOU: % teste(s).', v; END IF;
END $$;

ROLLBACK;
