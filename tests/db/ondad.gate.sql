-- 7D IMPORTS — Gate de banco da ONDA D (kits, estoque derivado, consumo,
-- estorno e RBAC de estoque). Roda em transação e faz ROLLBACK: nenhum dado
-- real permanece. Os usuários de teste são criados/removidos pelo runner
-- `tests/db/onda0-gate.py tests/db/ondad.gate.sql`, que injeta :adminid,
-- :vendedorid, :vendedor2id, :inativoid e :semcargoid.
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
CREATE OR REPLACE FUNCTION pg_temp.anon_()
RETURNS void LANGUAGE sql AS $$ SELECT set_config('request.jwt.claims','', true)::void $$;

-- Produto vendável: preço confirmado, quantidade conferida, publicado e com
-- tamanho confirmado por etiqueta (mesmo gate exigido em produção).
CREATE OR REPLACE FUNCTION pg_temp.novo_produto(
  p_slug text, p_modelo text, p_tam text, p_qtd int)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.produtos (sku, slug, nome, marca, categoria, descricao, imagens, preco,
                               ativo, destaque, modelo_estoque, preco_status,
                               status_publicacao, quantidade_conferida)
  VALUES (upper(p_slug), p_slug, initcap(replace(p_slug,'-',' ')), '7D', 'Testes', 'gate',
          '["/gate.jpg"]'::jsonb, 500, true, false, p_modelo, 'confirmado',
          'publicado', true)
  RETURNING id INTO v_id;
  INSERT INTO public.produto_variacoes (produto_id, tamanho, quantidade, origem_tamanho,
                                        origem_tamanho_evidencia, origem_tamanho_confirmado_em)
  VALUES (v_id, p_tam, p_qtd, 'confirmado_etiqueta', 'gate ONDA D', now());
  RETURN v_id;
END $$;

SELECT set_config('gate.admin', :'adminid', true),
       set_config('gate.vend',  :'vendedorid', true);

DO $gate$
DECLARE
  v_admin uuid; v_vend uuid;
  v_cli jsonb := jsonb_build_object('nome','Cliente OndaD','telefone','(31) 97777-6666','cpf','390.533.447-05');
  v_ent jsonb := jsonb_build_object('metodo','retirada','retirada',
      jsonb_build_object('date', to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1,'YYYY-MM-DD'),'time','10:00'));
  v_pag jsonb := jsonb_build_object('metodo','pix');
  v_kit uuid; v_kit2 uuid; v_a uuid; v_b uuid; v_unica uuid; v_normal uuid;
  v_pedido uuid; r record; v_n int; v_qa int; v_qb int; v_qk int; v_disp int;
  v_res jsonb;
BEGIN
  SELECT current_setting('gate.admin')::uuid, current_setting('gate.vend')::uuid
    INTO v_admin, v_vend;

  -- Cada cenário usa um telefone próprio: o cooldown anti-abuso é por
  -- telefone e não deve interferir nos testes de kit.

  v_a      := pg_temp.novo_produto('gate-d-comp-a','multi_variante','M',5);
  v_b      := pg_temp.novo_produto('gate-d-comp-b','multi_variante','M',4);
  v_unica  := pg_temp.novo_produto('gate-d-unica','peca_unica','U',1);
  v_normal := pg_temp.novo_produto('gate-d-normal','multi_variante','M',3);
  v_kit    := pg_temp.novo_produto('gate-d-kit','kit','M',0);
  v_kit2   := pg_temp.novo_produto('gate-d-kit2','kit','M',0);

  -- D-K01 kit sem composição não publica
  PERFORM pg_temp.check_('D-K01 kit sem composição não publica',
    (public.avaliar_publicacao(v_kit)->>'canPublish')::boolean IS FALSE
      AND public.avaliar_publicacao(v_kit)->'blockingReasons' @> '["Kit sem composição cadastrada"]',
    public.avaliar_publicacao(v_kit)::text);

  -- D-K02 kit não contém outro kit
  BEGIN
    INSERT INTO public.produto_kit_itens (kit_id, kit_tamanho, componente_id, componente_tamanho, quantidade)
    VALUES (v_kit, 'M', v_kit2, 'M', 1);
    PERFORM pg_temp.check_('D-K02 kit não contém outro kit', false, 'aceitou kit dentro de kit');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('D-K02 kit não contém outro kit', true, SQLERRM);
  END;

  -- D-K03 componente exige tamanho existente
  BEGIN
    INSERT INTO public.produto_kit_itens (kit_id, kit_tamanho, componente_id, componente_tamanho, quantidade)
    VALUES (v_kit, 'M', v_a, 'GG', 1);
    PERFORM pg_temp.check_('D-K03 componente exige tamanho existente', false, 'aceitou tamanho inexistente');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('D-K03 componente exige tamanho existente', true, SQLERRM);
  END;

  -- Composição real: 1x A + 2x B  → disponível = min(5/1, 4/2) = 2
  INSERT INTO public.produto_kit_itens (kit_id, kit_tamanho, componente_id, componente_tamanho, quantidade)
  VALUES (v_kit, 'M', v_a, 'M', 1), (v_kit, 'M', v_b, 'M', 2);

  v_disp := public.kit_disponivel(v_kit, 'M');
  PERFORM pg_temp.check_('D-K04 kit_disponivel usa o elo mais fraco', v_disp = 2, 'disponivel=' || v_disp);

  -- D-K05 kit publicável após composição
  PERFORM pg_temp.check_('D-K05 kit publicável após composição',
    (public.avaliar_publicacao(v_kit)->>'canPublish')::boolean,
    public.avaliar_publicacao(v_kit)::text);

  -- D-K06 explodir item de kit devolve as peças
  SELECT count(*) INTO v_n FROM public.explodir_item_pedido('gate-d-kit','M',2);
  PERFORM pg_temp.check_('D-K06 explodir kit devolve as peças', v_n = 2, 'linhas=' || v_n);
  SELECT quantidade INTO v_n FROM public.explodir_item_pedido('gate-d-kit','M',2)
   WHERE produto_id = v_b;
  PERFORM pg_temp.check_('D-K07 explodir multiplica a quantidade do componente', v_n = 4, 'qtd=' || v_n);

  -- D-K08 produto normal explode em si mesmo
  SELECT produto_id, quantidade INTO r FROM public.explodir_item_pedido('gate-d-normal','M',3);
  PERFORM pg_temp.check_('D-K08 produto normal explode em si mesmo',
    r.produto_id = v_normal AND r.quantidade = 3);

  -- D-K09 ajuste manual de estoque em kit é recusado
  PERFORM pg_temp.as_user(v_admin);
  BEGIN
    PERFORM public.ajustar_estoque(v_kit, 'M', 'entrada', 3, 'gate', NULL);
    PERFORM pg_temp.check_('D-K09 kit recusa movimentação direta', false, 'aceitou entrada em kit');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('D-K09 kit recusa movimentação direta', true, SQLERRM);
  END;

  -- D-K10 vendedor não movimenta estoque
  PERFORM pg_temp.as_user(v_vend);
  BEGIN
    PERFORM public.ajustar_estoque(v_a, 'M', 'entrada', 1, 'gate', NULL);
    PERFORM pg_temp.check_('D-K10 vendedor não movimenta estoque', false, 'aceitou movimentação');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('D-K10 vendedor não movimenta estoque', true, SQLERRM);
  END;
  PERFORM pg_temp.anon_();

  -- D-K11 checkout de kit reserva as peças componentes (nunca o kit)
  SELECT * INTO r FROM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','gate-d-kit','size','M','quantity',1)),
    jsonb_set(v_cli,'{telefone}', to_jsonb('(31) 97777-6601'::text)), v_ent, v_pag, NULL, 'site', 'gate-d-' || gen_random_uuid()::text);
  v_pedido := r.id;
  SELECT count(*) INTO v_n FROM public.reservas_estoque
   WHERE pedido_id = v_pedido AND produto_id IN (v_a, v_b);
  PERFORM pg_temp.check_('D-K11 checkout de kit reserva as peças', v_n = 2, 'reservas=' || v_n);
  SELECT count(*) INTO v_n FROM public.reservas_estoque
   WHERE pedido_id = v_pedido AND produto_id = v_kit;
  PERFORM pg_temp.check_('D-K12 kit não gera reserva própria', v_n = 0, 'reservas kit=' || v_n);

  SELECT disponivel INTO v_disp FROM public.produto_variacoes WHERE produto_id = v_b AND tamanho='M';
  PERFORM pg_temp.check_('D-K13 reserva do kit reduz disponível da peça', v_disp = 2, 'disponivel B=' || v_disp);

  -- D-K14 consumo do pedido baixa as peças, não o kit
  PERFORM pg_temp.as_user(v_admin);
  PERFORM public.transicionar_pedido(v_pedido, 'em_atendimento');
  PERFORM public.transicionar_pedido(v_pedido, 'aguardando_pagamento');
  PERFORM public.transicionar_pedido(v_pedido, 'pagamento_confirmado');
  PERFORM public.transicionar_pedido(v_pedido, 'separado');

  SELECT quantidade INTO v_qa FROM public.produto_variacoes WHERE produto_id = v_a AND tamanho='M';
  SELECT quantidade INTO v_qb FROM public.produto_variacoes WHERE produto_id = v_b AND tamanho='M';
  SELECT COALESCE(sum(quantidade),0) INTO v_qk FROM public.produto_variacoes WHERE produto_id = v_kit;
  PERFORM pg_temp.check_('D-K14 consumo baixa 1x peça A', v_qa = 4, 'A=' || v_qa);
  PERFORM pg_temp.check_('D-K15 consumo baixa 2x peça B', v_qb = 2, 'B=' || v_qb);
  PERFORM pg_temp.check_('D-K16 kit permanece sem saldo próprio', v_qk = 0, 'kit=' || v_qk);
  PERFORM pg_temp.check_('D-K17 reservas do kit viram venda',
    NOT EXISTS (SELECT 1 FROM public.reservas_estoque
                 WHERE pedido_id = v_pedido AND estado <> 'vendida'));

  -- D-K18 cancelamento estorna as peças
  PERFORM public.transicionar_pedido(v_pedido, 'cancelado');
  SELECT quantidade INTO v_qa FROM public.produto_variacoes WHERE produto_id = v_a AND tamanho='M';
  SELECT quantidade INTO v_qb FROM public.produto_variacoes WHERE produto_id = v_b AND tamanho='M';
  PERFORM pg_temp.check_('D-K18 cancelamento estorna peça A', v_qa = 5, 'A=' || v_qa);
  PERFORM pg_temp.check_('D-K19 cancelamento estorna peça B', v_qb = 4, 'B=' || v_qb);
  PERFORM pg_temp.check_('D-K20 movimentações registram kit explodido',
    (SELECT count(*) FROM public.produto_movimentacoes
      WHERE pedido_id = v_pedido AND produto_id = v_kit) = 0);
  PERFORM pg_temp.anon_();

  -- D-K21 kit sem saldo em uma peça bloqueia o checkout
  UPDATE public.produto_variacoes SET quantidade = 1 WHERE produto_id = v_b AND tamanho='M';
  BEGIN
    PERFORM public.criar_pedido(
      jsonb_build_array(jsonb_build_object('slug','gate-d-kit','size','M','quantity',1)),
      jsonb_set(v_cli,'{telefone}', to_jsonb('(31) 97777-6602'::text)), v_ent, v_pag, NULL, 'site', 'gate-d-' || gen_random_uuid()::text);
    PERFORM pg_temp.check_('D-K21 peça sem saldo bloqueia o kit', false, 'permitiu venda do kit');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('D-K21 peça sem saldo bloqueia o kit', true, SQLERRM);
  END;
  UPDATE public.produto_variacoes SET quantidade = 4 WHERE produto_id = v_b AND tamanho='M';

  -- D-K22 peça única componente não é vendida duas vezes
  INSERT INTO public.produto_kit_itens (kit_id, kit_tamanho, componente_id, componente_tamanho, quantidade)
  VALUES (v_kit2, 'M', v_unica, 'U', 1);
  UPDATE public.produto_variacoes SET tamanho = 'M' WHERE produto_id = v_kit2;
  PERFORM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','gate-d-unica','size','U','quantity',1)),
    jsonb_set(v_cli,'{telefone}', to_jsonb('(31) 97777-6603'::text)), v_ent, v_pag, NULL, 'site', 'gate-d-' || gen_random_uuid()::text);
  BEGIN
    PERFORM public.criar_pedido(
      jsonb_build_array(jsonb_build_object('slug','gate-d-unica','size','U','quantity',1)),
      jsonb_set(v_cli,'{telefone}', to_jsonb('(31) 97777-6604'::text)), v_ent, v_pag, NULL, 'site', 'gate-d-' || gen_random_uuid()::text);
    PERFORM pg_temp.check_('D-K22 peça única não vende duas vezes', false, 'vendeu duas vezes');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.check_('D-K22 peça única não vende duas vezes', true, SQLERRM);
  END;

  -- D-K23 kit cuja peça única já está reservada fica indisponível
  PERFORM pg_temp.check_('D-K23 kit com peça única reservada fica sem saldo',
    public.kit_disponivel(v_kit2, 'M') = 0, 'disp=' || public.kit_disponivel(v_kit2, 'M'));
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
  IF v > 0 THEN RAISE EXCEPTION 'GATE ONDA D FALHOU: % teste(s).', v; END IF;
END $$;

ROLLBACK;
