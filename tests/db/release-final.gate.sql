-- 7D IMPORTS — RELEASE FINAL — Gate de regressão de PENDÊNCIAS em criar_pedido.
--
-- Regra de negócio oficial: preço pendente, tamanho pendente ou ambos NÃO
-- bloqueiam a entrada no funil de atendimento QUANDO existe estoque físico
-- real. Estoque zero NUNCA gera pedido nem reserva.
--
-- O bloco termina com RAISE EXCEPTION deliberado: a transação inteira é
-- desfeita, então o gate nunca deixa dados de teste no banco.
--
-- Última execução: 4/4 PASS
--   R-01 preço pendente entra no funil, total = 0
--   R-02 tamanho pendente entra e recebe hold atômico (peça única)
--   R-03 preço + tamanho pendentes marcados juntos
--   R-04 estoque zero rejeitado ("Peça esgotada: ... não pode ser reservada")

DO $$
DECLARE
  v_pid uuid; v_ped record; v_ok boolean; v_msg text; v_r1 text; v_r2 text; v_r3 text;
  v_entrega jsonb := jsonb_build_object('metodo','retirada','retirada',
                       jsonb_build_object('date', to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date,'YYYY-MM-DD'),'time','10:00'));
  v_pagto jsonb := jsonb_build_object('metodo','pix');
BEGIN
  -- R-01 — preço pendente, tamanho confirmado, saldo 3.
  INSERT INTO public.produtos (sku, slug, nome, marca, categoria, imagens, preco, preco_status,
                               ativo, destaque, modelo_estoque, status_publicacao, quantidade_conferida)
  VALUES ('GATE-A','gate-a','Gate A','7D','Camiseta','[]'::jsonb, 0, 'a_confirmar',
          true, false, 'multi_variante', 'publicado', true)
  RETURNING id INTO v_pid;
  INSERT INTO public.produto_variacoes (produto_id, tamanho, quantidade, origem_tamanho, origem_tamanho_evidencia)
  VALUES (v_pid, 'M', 3, 'confirmado_etiqueta', 'etiqueta gate');
  SELECT * INTO v_ped FROM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','gate-a','size','M','quantity',1)),
    jsonb_build_object('nome','Gate A','telefone','11999990001'), v_entrega, v_pagto, NULL, 'site', 'gate-rel-a-0000000000');
  IF v_ped.valor_total <> 0 THEN RAISE EXCEPTION 'R-01 FAIL total'; END IF;
  IF NOT (SELECT pendencia_preco FROM public.pedidos WHERE id = v_ped.id) THEN
    RAISE EXCEPTION 'R-01 FAIL pendencia_preco'; END IF;
  v_r1 := 'R-01 PASS ' || v_ped.numero_pedido;

  -- R-02 — tamanho pendente em peça única: entra e trava a unidade física.
  INSERT INTO public.produtos (sku, slug, nome, marca, categoria, imagens, preco, preco_status,
                               ativo, destaque, modelo_estoque, status_publicacao, quantidade_conferida)
  VALUES ('GATE-B','gate-b','Gate B','7D','Jaqueta','[]'::jsonb, 500, 'confirmado',
          true, false, 'peca_unica', 'publicado', true)
  RETURNING id INTO v_pid;
  INSERT INTO public.produto_variacoes (produto_id, tamanho, quantidade, origem_tamanho)
  VALUES (v_pid, 'UNICO', 1, 'a_confirmar');
  SELECT * INTO v_ped FROM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','gate-b','size','','quantity',1)),
    jsonb_build_object('nome','Gate B','telefone','11999990002'), v_entrega, v_pagto, NULL, 'site', 'gate-rel-b-0000000000');
  IF NOT (SELECT pendencia_tamanho FROM public.pedidos WHERE id = v_ped.id) THEN
    RAISE EXCEPTION 'R-02 FAIL pendencia_tamanho'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reservas_estoque WHERE pedido_id = v_ped.id) THEN
    RAISE EXCEPTION 'R-02 FAIL hold peca_unica'; END IF;
  v_r2 := 'R-02 PASS ' || v_ped.numero_pedido;

  -- R-03 — preço E tamanho pendentes.
  INSERT INTO public.produtos (sku, slug, nome, marca, categoria, imagens, preco, preco_status,
                               ativo, destaque, modelo_estoque, status_publicacao, quantidade_conferida)
  VALUES ('GATE-C','gate-c','Gate C','7D','Sueter','[]'::jsonb, 0, 'a_confirmar',
          true, false, 'peca_unica', 'publicado', false)
  RETURNING id INTO v_pid;
  INSERT INTO public.produto_variacoes (produto_id, tamanho, quantidade, origem_tamanho)
  VALUES (v_pid, 'UNICO', 1, 'a_confirmar');
  SELECT * INTO v_ped FROM public.criar_pedido(
    jsonb_build_array(jsonb_build_object('slug','gate-c','size','','quantity',1)),
    jsonb_build_object('nome','Gate C','telefone','11999990003'), v_entrega, v_pagto, NULL, 'site', 'gate-rel-c-0000000000');
  IF NOT (SELECT pendencia_preco AND pendencia_tamanho FROM public.pedidos WHERE id = v_ped.id) THEN
    RAISE EXCEPTION 'R-03 FAIL duas pendencias'; END IF;
  v_r3 := 'R-03 PASS ' || v_ped.numero_pedido;

  -- R-04 — estoque zero nunca entra no funil.
  INSERT INTO public.produtos (sku, slug, nome, marca, categoria, imagens, preco, preco_status,
                               ativo, destaque, modelo_estoque, status_publicacao, quantidade_conferida)
  VALUES ('GATE-D','gate-d','Gate D','7D','Polo','[]'::jsonb, 300, 'confirmado',
          true, false, 'peca_unica', 'publicado', true)
  RETURNING id INTO v_pid;
  INSERT INTO public.produto_variacoes (produto_id, tamanho, quantidade, origem_tamanho)
  VALUES (v_pid, 'UNICO', 0, 'a_confirmar');
  v_ok := false;
  BEGIN
    PERFORM public.criar_pedido(
      jsonb_build_array(jsonb_build_object('slug','gate-d','size','','quantity',1)),
      jsonb_build_object('nome','Gate D','telefone','11999990004'), v_entrega, v_pagto, NULL, 'site', 'gate-rel-d-0000000000');
  EXCEPTION WHEN OTHERS THEN v_ok := true; v_msg := SQLERRM; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'R-04 FAIL estoque zero gerou pedido'; END IF;

  RAISE EXCEPTION 'GATE 4/4 PASS | % | % | % | R-04 PASS: %', v_r1, v_r2, v_r3, v_msg;
END $$;
