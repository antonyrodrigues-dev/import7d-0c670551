-- 7D IMPORTS — RELEASE FINAL — Gate de regressão de PENDÊNCIAS em criar_pedido.
--
-- Regra oficial: preço pendente, tamanho pendente ou ambos NÃO bloqueiam a
-- entrada no funil de atendimento QUANDO existe estoque físico real.
-- Estoque zero NUNCA gera pedido/reserva.
--
-- Executa dentro de uma transação e faz ROLLBACK: não deixa dados de teste.

BEGIN;
SET LOCAL ROLE postgres;

DO $$
DECLARE
  v_pid uuid; v_ped record; v_ok boolean; v_msg text;
  v_cliente jsonb := jsonb_build_object('nome','Gate Release','telefone','11999990000');
  v_entrega jsonb := jsonb_build_object('metodo','retirada','retirada',
                       jsonb_build_object('date', to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date,'YYYY-MM-DD'),'time','10:00'));
  v_pagto jsonb := jsonb_build_object('metodo','pix');
BEGIN
  -- ---------- Fixture A: preço PENDENTE, tamanho confirmado, saldo 3 ----------
  INSERT INTO public.produtos (sku, slug, nome, marca, categoria, imagens, preco, preco_status,
                               ativo, destaque, modelo_estoque, status_publicacao, quantidade_conferida)
  VALUES ('GATE-A','gate-a','Gate A','7D','Camiseta','[]'::jsonb, 0, 'a_confirmar',
          true, false, 'multi_variante', 'publicado', true)
  RETURNING id INTO v_pid;
  INSERT INTO public.produto_variacoes (produto_id, tamanho, quantidade, origem_tamanho, origem_tamanho_evidencia)
  VALUES (v_pid, 'M', 3, 'confirmado_etiqueta', 'etiqueta gate');

  SELECT * INTO v_ped FROM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','gate-a','size','M','quantity',1)),
    v_cliente, v_entrega, v_pagto, NULL, 'site', 'gate-rel-a-0000000000');
  PERFORM 1;
  IF v_ped.valor_total <> 0 THEN RAISE EXCEPTION 'R-01 FAIL: total deveria ser 0'; END IF;
  IF NOT (SELECT pendencia_preco FROM public.pedidos WHERE id = v_ped.id) THEN
    RAISE EXCEPTION 'R-01 FAIL: pendencia_preco não marcada';
  END IF;
  RAISE NOTICE 'PASS R-01 preço pendente entra no funil (pedido %)', v_ped.numero_pedido;

  -- ---------- Fixture B: tamanho PENDENTE (peça única), saldo 1 ----------
  INSERT INTO public.produtos (sku, slug, nome, marca, categoria, imagens, preco, preco_status,
                               ativo, destaque, modelo_estoque, status_publicacao, quantidade_conferida)
  VALUES ('GATE-B','gate-b','Gate B','7D','Jaqueta','[]'::jsonb, 500, 'confirmado',
          true, false, 'peca_unica', 'publicado', true)
  RETURNING id INTO v_pid;
  INSERT INTO public.produto_variacoes (produto_id, tamanho, quantidade, origem_tamanho)
  VALUES (v_pid, 'UNICO', 1, 'pendente');

  SELECT * INTO v_ped FROM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','gate-b','size','','quantity',1)),
    v_cliente, v_entrega, v_pagto, NULL, 'site', 'gate-rel-b-0000000000');
  IF NOT (SELECT pendencia_tamanho FROM public.pedidos WHERE id = v_ped.id) THEN
    RAISE EXCEPTION 'R-02 FAIL: pendencia_tamanho não marcada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reservas_estoque WHERE pedido_id = v_ped.id) THEN
    RAISE EXCEPTION 'R-02 FAIL: peça única sem hold atômico';
  END IF;
  RAISE NOTICE 'PASS R-02 tamanho pendente com hold físico (pedido %)', v_ped.numero_pedido;

  -- ---------- Fixture C: preço E tamanho pendentes ----------
  INSERT INTO public.produtos (sku, slug, nome, marca, categoria, imagens, preco, preco_status,
                               ativo, destaque, modelo_estoque, status_publicacao, quantidade_conferida)
  VALUES ('GATE-C','gate-c','Gate C','7D','Suéter','[]'::jsonb, 0, 'a_confirmar',
          true, false, 'peca_unica', 'publicado', false)
  RETURNING id INTO v_pid;
  INSERT INTO public.produto_variacoes (produto_id, tamanho, quantidade, origem_tamanho)
  VALUES (v_pid, 'UNICO', 1, 'pendente');

  SELECT * INTO v_ped FROM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','gate-c','size','','quantity',1)),
    v_cliente, v_entrega, v_pagto, NULL, 'site', 'gate-rel-c-0000000000');
  IF NOT (SELECT pendencia_preco AND pendencia_tamanho FROM public.pedidos WHERE id = v_ped.id) THEN
    RAISE EXCEPTION 'R-03 FAIL: duas pendências não marcadas';
  END IF;
  IF v_ped.valor_total <> 0 THEN RAISE EXCEPTION 'R-03 FAIL: total deveria ser 0'; END IF;
  RAISE NOTICE 'PASS R-03 preço + tamanho pendentes (pedido %)', v_ped.numero_pedido;

  -- ---------- Fixture D: estoque ZERO com tamanho pendente ----------
  INSERT INTO public.produtos (sku, slug, nome, marca, categoria, imagens, preco, preco_status,
                               ativo, destaque, modelo_estoque, status_publicacao, quantidade_conferida)
  VALUES ('GATE-D','gate-d','Gate D','7D','Polo','[]'::jsonb, 300, 'confirmado',
          true, false, 'peca_unica', 'publicado', true)
  RETURNING id INTO v_pid;
  INSERT INTO public.produto_variacoes (produto_id, tamanho, quantidade, origem_tamanho)
  VALUES (v_pid, 'UNICO', 0, 'pendente');

  v_ok := false;
  BEGIN
    PERFORM public.criar_pedido(
      jsonb_build_array(jsonb_build_object('slug','gate-d','size','','quantity',1)),
      v_cliente, v_entrega, v_pagto, NULL, 'site', 'gate-rel-d-0000000000');
  EXCEPTION WHEN OTHERS THEN
    v_ok := true; v_msg := SQLERRM;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'R-04 FAIL: estoque zero gerou pedido'; END IF;
  RAISE NOTICE 'PASS R-04 estoque zero rejeitado (%)', v_msg;

  RAISE NOTICE 'RELEASE-FINAL PENDENCIAS GATE: 4/4 PASS';
END $$;

ROLLBACK;
